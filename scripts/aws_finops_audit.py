#!/usr/bin/env python3
"""
Small AWS FinOps inventory/audit using only the AWS CLI plus Python stdlib.

It intentionally does not read or write AWS credentials. Export temporary AWS
credentials in your shell, then run this script from the same shell.
"""

from __future__ import annotations

import csv
import json
import os
import statistics
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


REGIONS = [r.strip() for r in os.getenv("AWS_FINOPS_REGIONS", "us-east-1,us-east-2").split(",") if r.strip()]
DAYS = int(os.getenv("AWS_FINOPS_DAYS", "14"))
SNAPSHOT_AGE_DAYS = int(os.getenv("AWS_FINOPS_SNAPSHOT_AGE_DAYS", "30"))
OUT_DIR = Path(os.getenv("AWS_FINOPS_OUT_DIR", "finops-output")) / datetime.now().strftime("%Y%m%d-%H%M%S")


def run_aws(args: list[str], region: str | None = None) -> dict[str, Any]:
    cmd = ["aws", *args]
    if region:
        cmd.extend(["--region", region])
    cmd.extend(["--output", "json"])

    proc = subprocess.run(cmd, text=True, capture_output=True)
    if proc.returncode != 0:
        raise RuntimeError(f"aws {' '.join(args[:2])} failed in {region or 'global'}: {proc.stderr.strip()}")
    if not proc.stdout.strip():
        return {}
    return json.loads(proc.stdout)


def write_csv(path: Path, rows: list[dict[str, Any]], columns: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow({k: flatten(row.get(k)) for k in columns})


def flatten(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (str, int, float, bool)):
        return str(value)
    return json.dumps(value, ensure_ascii=False, sort_keys=True)


def tag_value(tags: list[dict[str, str]] | None, key: str) -> str:
    for tag in tags or []:
        if tag.get("Key") == key:
            return tag.get("Value", "")
    return ""


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def instance_inventory(region: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    data = run_aws(["ec2", "describe-instances"], region)
    rows: list[dict[str, Any]] = []
    for reservation in data.get("Reservations", []):
        for inst in reservation.get("Instances", []):
            tags = inst.get("Tags", [])
            rows.append(
                {
                    "region": region,
                    "name": tag_value(tags, "Name"),
                    "instance_id": inst.get("InstanceId"),
                    "state": (inst.get("State") or {}).get("Name"),
                    "instance_type": inst.get("InstanceType"),
                    "az": (inst.get("Placement") or {}).get("AvailabilityZone"),
                    "launch_time": inst.get("LaunchTime"),
                    "private_ip": inst.get("PrivateIpAddress"),
                    "public_ip": inst.get("PublicIpAddress"),
                    "vpc_id": inst.get("VpcId"),
                    "subnet_id": inst.get("SubnetId"),
                    "monitoring": (inst.get("Monitoring") or {}).get("State"),
                    "owner": tag_value(tags, "Owner") or tag_value(tags, "owner"),
                    "environment": tag_value(tags, "Environment") or tag_value(tags, "env"),
                    "project": tag_value(tags, "Project") or tag_value(tags, "project"),
                    "tags": {t.get("Key"): t.get("Value") for t in tags},
                }
            )

    stopped = [r for r in rows if r.get("state") == "stopped"]
    running = [r for r in rows if r.get("state") == "running"]
    return rows, stopped, running


def ec2_cpu_candidates(region: str, running_instances: list[dict[str, Any]]) -> list[dict[str, Any]]:
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=DAYS)
    candidates: list[dict[str, Any]] = []

    for inst in running_instances:
        instance_id = inst["instance_id"]
        try:
            data = run_aws(
                [
                    "cloudwatch",
                    "get-metric-statistics",
                    "--namespace",
                    "AWS/EC2",
                    "--metric-name",
                    "CPUUtilization",
                    "--dimensions",
                    f"Name=InstanceId,Value={instance_id}",
                    "--start-time",
                    iso(start),
                    "--end-time",
                    iso(end),
                    "--period",
                    "86400",
                    "--statistics",
                    "Average",
                    "Maximum",
                ],
                region,
            )
        except RuntimeError as exc:
            candidates.append({**inst, "cpu_error": str(exc)})
            continue

        points = data.get("Datapoints", [])
        if not points:
            candidates.append(
                {
                    **inst,
                    "cpu_avg_pct": "",
                    "cpu_max_pct": "",
                    "samples": 0,
                    "reason": f"No CPU datapoints in the last {DAYS} days",
                }
            )
            continue

        avg = statistics.fmean(float(p.get("Average", 0)) for p in points)
        max_cpu = max(float(p.get("Maximum", 0)) for p in points)
        if avg <= 5 and max_cpu <= 20:
            candidates.append(
                {
                    **inst,
                    "cpu_avg_pct": round(avg, 2),
                    "cpu_max_pct": round(max_cpu, 2),
                    "samples": len(points),
                    "reason": f"Low CPU for {DAYS} days: avg <= 5% and max <= 20%",
                }
            )

    return candidates


def available_volumes(region: str) -> list[dict[str, Any]]:
    data = run_aws(["ec2", "describe-volumes", "--filters", "Name=status,Values=available"], region)
    rows = []
    for vol in data.get("Volumes", []):
        tags = vol.get("Tags", [])
        rows.append(
            {
                "region": region,
                "name": tag_value(tags, "Name"),
                "volume_id": vol.get("VolumeId"),
                "size_gib": vol.get("Size"),
                "volume_type": vol.get("VolumeType"),
                "iops": vol.get("Iops"),
                "throughput": vol.get("Throughput"),
                "az": vol.get("AvailabilityZone"),
                "create_time": vol.get("CreateTime"),
                "encrypted": vol.get("Encrypted"),
                "reason": "EBS volume is available/unattached",
                "tags": {t.get("Key"): t.get("Value") for t in tags},
            }
        )
    return rows


def unattached_eips(region: str) -> list[dict[str, Any]]:
    data = run_aws(["ec2", "describe-addresses"], region)
    rows = []
    for addr in data.get("Addresses", []):
        if not addr.get("InstanceId") and not addr.get("NetworkInterfaceId"):
            rows.append(
                {
                    "region": region,
                    "allocation_id": addr.get("AllocationId"),
                    "public_ip": addr.get("PublicIp"),
                    "domain": addr.get("Domain"),
                    "reason": "Elastic IP is not associated to an instance or network interface",
                    "tags": {t.get("Key"): t.get("Value") for t in addr.get("Tags", [])},
                }
            )
    return rows


def old_snapshots(region: str) -> list[dict[str, Any]]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=SNAPSHOT_AGE_DAYS)
    data = run_aws(["ec2", "describe-snapshots", "--owner-ids", "self"], region)
    rows = []
    for snap in data.get("Snapshots", []):
        start_time = snap.get("StartTime")
        if not start_time:
            continue
        snap_dt = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
        if snap_dt <= cutoff:
            tags = snap.get("Tags", [])
            rows.append(
                {
                    "region": region,
                    "name": tag_value(tags, "Name"),
                    "snapshot_id": snap.get("SnapshotId"),
                    "volume_id": snap.get("VolumeId"),
                    "volume_size_gib": snap.get("VolumeSize"),
                    "start_time": start_time,
                    "age_days": (datetime.now(timezone.utc) - snap_dt).days,
                    "state": snap.get("State"),
                    "encrypted": snap.get("Encrypted"),
                    "reason": f"Snapshot older than {SNAPSHOT_AGE_DAYS} days",
                    "tags": {t.get("Key"): t.get("Value") for t in tags},
                }
            )
    return sorted(rows, key=lambda x: (int(x.get("volume_size_gib") or 0), int(x.get("age_days") or 0)), reverse=True)


def elb_without_healthy_targets(region: str) -> list[dict[str, Any]]:
    rows = []
    data = run_aws(["elbv2", "describe-load-balancers"], region)
    for lb in data.get("LoadBalancers", []):
        lb_arn = lb.get("LoadBalancerArn")
        try:
            tgs = run_aws(["elbv2", "describe-target-groups", "--load-balancer-arn", lb_arn], region).get("TargetGroups", [])
        except RuntimeError:
            tgs = []
        registered = 0
        healthy = 0
        for tg in tgs:
            health = run_aws(["elbv2", "describe-target-health", "--target-group-arn", tg["TargetGroupArn"]], region)
            for desc in health.get("TargetHealthDescriptions", []):
                registered += 1
                if (desc.get("TargetHealth") or {}).get("State") == "healthy":
                    healthy += 1
        if not tgs or registered == 0 or healthy == 0:
            rows.append(
                {
                    "region": region,
                    "name": lb.get("LoadBalancerName"),
                    "load_balancer_arn": lb_arn,
                    "type": lb.get("Type"),
                    "scheme": lb.get("Scheme"),
                    "state": (lb.get("State") or {}).get("Code"),
                    "target_groups": len(tgs),
                    "registered_targets": registered,
                    "healthy_targets": healthy,
                    "reason": "No target groups, no registered targets, or zero healthy targets",
                }
            )

    classic = run_aws(["elb", "describe-load-balancers"], region)
    for lb in classic.get("LoadBalancerDescriptions", []):
        instances = lb.get("Instances", [])
        if not instances:
            rows.append(
                {
                    "region": region,
                    "name": lb.get("LoadBalancerName"),
                    "load_balancer_arn": "",
                    "type": "classic",
                    "scheme": lb.get("Scheme"),
                    "state": "",
                    "target_groups": "",
                    "registered_targets": 0,
                    "healthy_targets": "",
                    "reason": "Classic ELB has no registered instances",
                }
            )
    return rows


def rds_stopped(region: str) -> list[dict[str, Any]]:
    rows = []
    try:
        data = run_aws(["rds", "describe-db-instances"], region)
    except RuntimeError as exc:
        return [{"region": region, "error": str(exc)}]
    for db in data.get("DBInstances", []):
        if db.get("DBInstanceStatus") == "stopped":
            rows.append(
                {
                    "region": region,
                    "db_instance_identifier": db.get("DBInstanceIdentifier"),
                    "engine": db.get("Engine"),
                    "db_instance_class": db.get("DBInstanceClass"),
                    "allocated_storage_gib": db.get("AllocatedStorage"),
                    "multi_az": db.get("MultiAZ"),
                    "status": db.get("DBInstanceStatus"),
                    "reason": "RDS instance is stopped",
                }
            )
    return rows


def main() -> int:
    missing = [name for name in ("AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_SESSION_TOKEN") if not os.getenv(name)]
    if missing:
        print(f"Missing AWS env vars: {', '.join(missing)}", file=sys.stderr)
        print("Export your temporary AWS credentials first, then run this script.", file=sys.stderr)
        return 2

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    raw_dir = OUT_DIR / "raw"
    raw_dir.mkdir(exist_ok=True)

    identity = run_aws(["sts", "get-caller-identity"], None)
    (OUT_DIR / "account_identity.json").write_text(json.dumps(identity, indent=2), encoding="utf-8")

    findings: list[dict[str, Any]] = []
    summary: dict[str, Any] = {"identity": identity, "regions": {}, "output_dir": str(OUT_DIR)}

    for region in REGIONS:
        all_instances, stopped_instances, running_instances = instance_inventory(region)
        low_cpu = ec2_cpu_candidates(region, running_instances)
        volumes = available_volumes(region)
        eips = unattached_eips(region)
        snapshots = old_snapshots(region)
        elbs = elb_without_healthy_targets(region)
        rds = rds_stopped(region)

        write_csv(OUT_DIR / f"{region}_ec2_instances.csv", all_instances, EC2_COLUMNS)
        write_csv(OUT_DIR / f"{region}_ec2_stopped.csv", stopped_instances, EC2_COLUMNS)
        write_csv(OUT_DIR / f"{region}_ec2_low_cpu_candidates.csv", low_cpu, LOW_CPU_COLUMNS)
        write_csv(OUT_DIR / f"{region}_ebs_available.csv", volumes, VOLUME_COLUMNS)
        write_csv(OUT_DIR / f"{region}_eip_unattached.csv", eips, EIP_COLUMNS)
        write_csv(OUT_DIR / f"{region}_snapshots_old.csv", snapshots, SNAPSHOT_COLUMNS)
        write_csv(OUT_DIR / f"{region}_elb_without_healthy_targets.csv", elbs, ELB_COLUMNS)
        write_csv(OUT_DIR / f"{region}_rds_stopped.csv", rds, RDS_COLUMNS)

        summary["regions"][region] = {
            "ec2_total": len(all_instances),
            "ec2_running": len(running_instances),
            "ec2_stopped": len(stopped_instances),
            "ec2_low_cpu_candidates": len(low_cpu),
            "ebs_available": len(volumes),
            "eip_unattached": len(eips),
            "old_snapshots": len(snapshots),
            "elb_without_healthy_targets": len(elbs),
            "rds_stopped": len(rds),
        }

        findings.extend(to_findings("ec2_stopped", "medium", stopped_instances, "instance_id"))
        findings.extend(to_findings("ec2_low_cpu", "review", low_cpu, "instance_id"))
        findings.extend(to_findings("ebs_available", "high", volumes, "volume_id"))
        findings.extend(to_findings("eip_unattached", "medium", eips, "public_ip"))
        findings.extend(to_findings("snapshot_old", "review", snapshots, "snapshot_id"))
        findings.extend(to_findings("elb_without_healthy_targets", "high", elbs, "name"))
        findings.extend(to_findings("rds_stopped", "medium", rds, "db_instance_identifier"))

    write_csv(OUT_DIR / "all_findings.csv", findings, FINDING_COLUMNS)
    (OUT_DIR / "summary.json").write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
    (OUT_DIR / "summary.md").write_text(render_summary(summary, findings), encoding="utf-8")

    print(f"FinOps audit complete: {OUT_DIR}")
    print(json.dumps(summary["regions"], indent=2))
    return 0


def to_findings(category: str, severity: str, rows: list[dict[str, Any]], resource_key: str) -> list[dict[str, Any]]:
    out = []
    for row in rows:
        out.append(
            {
                "severity": severity,
                "category": category,
                "region": row.get("region", ""),
                "resource_id": row.get(resource_key, ""),
                "name": row.get("name") or row.get("db_instance_identifier") or "",
                "reason": row.get("reason", ""),
                "details": row,
            }
        )
    return out


def render_summary(summary: dict[str, Any], findings: list[dict[str, Any]]) -> str:
    lines = [
        "# AWS FinOps Audit",
        "",
        f"Account: `{summary['identity'].get('Account', '')}`",
        f"Caller ARN: `{summary['identity'].get('Arn', '')}`",
        f"Lookback days: `{DAYS}`",
        f"Snapshot age threshold days: `{SNAPSHOT_AGE_DAYS}`",
        "",
        "## Regional Summary",
        "",
        "| Region | EC2 total | Running | Stopped | Low CPU | EBS available | EIP unattached | Old snapshots | ELB no healthy targets | RDS stopped |",
        "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for region, data in summary["regions"].items():
        lines.append(
            "| {region} | {ec2_total} | {ec2_running} | {ec2_stopped} | {ec2_low_cpu_candidates} | {ebs_available} | {eip_unattached} | {old_snapshots} | {elb_without_healthy_targets} | {rds_stopped} |".format(
                region=region, **data
            )
        )
    lines.extend(
        [
            "",
            "## Review Guidance",
            "",
            "- High: usually safe first review candidates, but validate ownership and backup requirements.",
            "- Medium: good savings candidates, validate whether resources are intentionally parked.",
            "- Review: needs workload owner confirmation before stopping/resizing/deleting.",
            "",
            "Detailed CSV files are in the same output directory.",
        ]
    )
    return "\n".join(lines) + "\n"


EC2_COLUMNS = [
    "region",
    "name",
    "instance_id",
    "state",
    "instance_type",
    "az",
    "launch_time",
    "private_ip",
    "public_ip",
    "vpc_id",
    "subnet_id",
    "monitoring",
    "owner",
    "environment",
    "project",
    "tags",
]
LOW_CPU_COLUMNS = EC2_COLUMNS + ["cpu_avg_pct", "cpu_max_pct", "samples", "reason", "cpu_error"]
VOLUME_COLUMNS = ["region", "name", "volume_id", "size_gib", "volume_type", "iops", "throughput", "az", "create_time", "encrypted", "reason", "tags"]
EIP_COLUMNS = ["region", "allocation_id", "public_ip", "domain", "reason", "tags"]
SNAPSHOT_COLUMNS = ["region", "name", "snapshot_id", "volume_id", "volume_size_gib", "start_time", "age_days", "state", "encrypted", "reason", "tags"]
ELB_COLUMNS = ["region", "name", "load_balancer_arn", "type", "scheme", "state", "target_groups", "registered_targets", "healthy_targets", "reason"]
RDS_COLUMNS = ["region", "db_instance_identifier", "engine", "db_instance_class", "allocated_storage_gib", "multi_az", "status", "reason", "error"]
FINDING_COLUMNS = ["severity", "category", "region", "resource_id", "name", "reason", "details"]


if __name__ == "__main__":
    raise SystemExit(main())
