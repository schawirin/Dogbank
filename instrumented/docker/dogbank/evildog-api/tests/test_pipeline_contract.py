"""Focused regression tests for the deterministic EvilDog demo contract.

These tests do not invoke attack tools or a real bank.  They validate the state,
identity and response-classification boundaries that make the UI truthful.
"""
import asyncio
from pathlib import Path
import sys

import pytest
from fastapi.testclient import TestClient


APP_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(APP_ROOT))
from app import main  # noqa: E402


class Response:
    def __init__(self, status_code, text="", headers=None, url="http://bank.test/api"):
        self.status_code = status_code
        self.text = text
        self.headers = headers or {}
        self.url = url


@pytest.fixture(autouse=True)
def reset_pipeline_state(monkeypatch):
    original_ip = main._SPOOF["ip"]
    # Reset tests must not reach a real service. Individual preflight tests
    # override this boundary when validating blocked/error behavior.
    monkeypatch.setattr(
        main.requests,
        "get",
        lambda *args, **kwargs: Response(200, "ok", url="http://bank.test/readiness"),
    )
    main.API_STATE["last_pipeline"] = {}
    main.API_STATE["pipeline"].update({
        "run_id": None,
        "status": "idle",
        "source_ip": None,
        "outcome": None,
        "detail": None,
        "started_at": None,
        "finished_at": None,
    })
    main.API_STATE["findings"] = 0
    main.API_STATE["compromised"].clear()
    main.API_STATE["records_leaked_total"] = 0
    main.API_STATE["secrets"] = []
    main.API_STATE["loot_records"] = []
    main.API_STATE["pix_stolen"] = []
    main.API_STATE["agents"] = {}
    main.API_STATE["last_escalate_at"] = 0.0
    for key in main.attacker.stats:
        main.attacker.stats[key] = 0
    main._CONTROL_SESSIONS.clear()
    yield
    main._CONTROL_SESSIONS.clear()
    main._SPOOF["ip"] = original_ip


@pytest.mark.parametrize(
    ("response", "exception"),
    [
        (Response(403, "{\"error\":\"usuario bloqueado\"}"), main.UserBlockedError),
        (Response(403, "{\"error\":\"Account temporarily blocked due to suspicious activity\"}"), main.UserBlockedError),
        (Response(403, "Datadog AppSec blocked this request"), main.BlockedError),
        (Response(403, "bloqueado pela Datadog AppSec"), main.BlockedError),
        (Response(406, "", {"X-Datadog-Rule": "demo"}), main.BlockedError),
        (Response(429, "too many requests"), main.RateLimitedError),
        (Response(500, "upstream failure"), main.BackendError),
        # The former implementation called this AAP_BLOCKED.  A bare 403 has no
        # attribution evidence and must not lie to the presenter.
        (Response(403, "forbidden"), main.BackendError),
    ],
)
def test_response_classification_is_explicit(response, exception):
    assert isinstance(main._classify_response(response), exception)


def test_pipe_request_uses_frozen_run_ip(monkeypatch):
    captured = {}

    def fake_request(method, url, headers, **kwargs):
        captured.update(headers)
        return Response(200, "ok", url=url)

    monkeypatch.setattr(main.requests, "request", fake_request)
    token = main._RUN_SOURCE_IP.set("203.0.113.77")
    try:
        main._pipe_request("GET", "http://bank.test/recon")
    finally:
        main._RUN_SOURCE_IP.reset(token)

    assert captured["X-Forwarded-For"] == "203.0.113.77"
    assert captured["X-Real-IP"] == "203.0.113.77"


def test_source_ip_preflight_requires_a_fresh_http_200(monkeypatch):
    monkeypatch.setattr(
        main.requests,
        "get",
        lambda *args, **kwargs: Response(200, "ok", url="http://bank.test/readiness"),
    )
    assert main._source_ip_is_available("203.0.113.77") is True

    monkeypatch.setattr(
        main.requests,
        "get",
        lambda *args, **kwargs: Response(
            403,
            "Datadog AppSec blocked this request",
            url="http://bank.test/readiness",
        ),
    )
    assert main._source_ip_is_available("203.0.113.77") is False

    monkeypatch.setattr(
        main.requests,
        "get",
        lambda *args, **kwargs: Response(404, "missing", url="http://bank.test/readiness"),
    )
    with pytest.raises(main.BackendError, match="esperava HTTP 200"):
        main._source_ip_is_available("203.0.113.77")


def test_aap_enforcement_wait_retries_same_ip_until_real_block(monkeypatch):
    calls = []

    def probe(method, url, xff=None, **kwargs):
        calls.append(xff)
        if len(calls) == 3:
            raise main.BlockedError("Datadog block propagated")
        return Response(400, "not blocked", url=url)

    monkeypatch.setattr(main, "_pipe_request", probe)
    monkeypatch.setattr(main.time, "monotonic", lambda: 0.0)
    monkeypatch.setattr(main.time, "sleep", lambda *_: None)

    with pytest.raises(main.BlockedError):
        main._await_aap_enforcement("203.0.113.77", grace_s=10, poll_s=0.01)

    assert calls == ["203.0.113.77", "203.0.113.77", "203.0.113.77"]


def test_aap_enforcement_wait_fails_closed_when_block_never_arrives(monkeypatch):
    calls = []
    clock = iter([0.0, 0.0, 1.0])

    def probe(method, url, xff=None, **kwargs):
        calls.append(xff)
        return Response(200, "allowed", url=url)

    monkeypatch.setattr(main, "_pipe_request", probe)
    monkeypatch.setattr(main.time, "monotonic", lambda: next(clock))
    monkeypatch.setattr(main.time, "sleep", lambda *_: None)

    with pytest.raises(main.AapEnforcementTimeoutError, match="continuou respondendo HTTP 200"):
        main._await_aap_enforcement("203.0.113.77", grace_s=0.5, poll_s=0.01)

    assert calls == ["203.0.113.77", "203.0.113.77"]


def test_expected_aap_block_stops_before_attack_tools_when_not_enforced(monkeypatch):
    monkeypatch.setattr(main, "_stage", lambda *_: 0.0)
    monkeypatch.setattr(
        main,
        "_await_aap_enforcement",
        lambda *_: (_ for _ in ()).throw(main.AapEnforcementTimeoutError("HTTP 200 após a janela")),
    )
    tool_calls = []
    monkeypatch.setattr(main, "_run_tool", lambda *args, **kwargs: tool_calls.append(args) or (0, ""))

    main._start_pipeline_state("run-aap-timeout", "203.0.113.77")
    result = main._run_pipeline("run-aap-timeout", "203.0.113.77", verify_enforcement=True)

    assert result == "error"
    assert tool_calls == []
    assert main.API_STATE["last_pipeline"]["RECON"] == "fail"
    assert main.API_STATE["pipeline"]["outcome"] == "AAP_NOT_ENFORCED"
    assert "antes da exploração" in main.API_STATE["pipeline"]["detail"]


def test_pipeline_state_contains_recovery_contract():
    main._start_pipeline_state("run-demo", "203.0.113.8")
    main.API_STATE["last_pipeline"]["RECON"] = "success"
    main._finish_pipeline_state("blocked", "AAP_BLOCKED", "Datadog blocked request")

    snapshot = main._pipeline_snapshot()
    assert snapshot["run_id"] == "run-demo"
    assert snapshot["status"] == "blocked"
    assert snapshot["source_ip"] == "203.0.113.8"
    assert snapshot["nodes"]["RECON"] == "success"
    assert snapshot["outcome"] == "AAP_BLOCKED"
    assert snapshot["detail"] == "Datadog blocked request"


def test_ephemeral_agent_exit_code_reflects_attack_outcome():
    assert main._agent_process_exit_code("done") == 0
    assert main._agent_process_exit_code("blocked") == 1
    assert main._agent_process_exit_code("error") == 1


def test_swarm_summary_does_not_report_contained_agents_as_success():
    names = ["agent-0", "agent-1", "agent-2"]
    main.API_STATE["agents"] = {
        name: {"outcome": "blocked", "phase": "Deleted"} for name in names
    }

    summary = main._swarm_completion(names, {name: "Failed" for name in names})

    assert summary["state"] == "failed"
    assert summary["level"] == "critical"
    assert summary["failed_agents"] == 3


def test_aap_sync_wait_is_only_enabled_for_same_ip_after_success():
    previous = {"status": "done", "source_ip": "203.0.113.8", "outcome": "SUCCESS"}

    assert main._should_verify_aap_enforcement(previous, "203.0.113.8") is True
    assert main._should_verify_aap_enforcement(previous, "203.0.113.9") is False
    assert main._should_verify_aap_enforcement({**previous, "status": "blocked"}, "203.0.113.8") is False


def test_active_pipeline_rejects_rotation_and_second_run(monkeypatch):
    main._start_pipeline_state("run-active", "203.0.113.9")

    rotate = asyncio.run(main.rotate_ip())
    assert rotate.status_code == 409

    run = asyncio.run(main.pipeline_run())
    assert run.status_code == 409


def test_ato_does_not_treat_rate_limited_login_as_compromise(monkeypatch):
    main.API_STATE["loot_records"] = [{
        "nome": "vitima", "cpf": "12345678900", "senha": "password",
        "mfa": False, "chave_pix": "victim@bank.test",
    }]

    monkeypatch.setattr(main, "_stage", lambda *_: 0)
    monkeypatch.setattr(main, "_dwell", lambda *_: None)
    monkeypatch.setattr(main.requests, "request", lambda *args, **kwargs: Response(429, "rate limited"))

    with pytest.raises(main.RateLimitedError):
        main._ato_transfer()


def test_terminal_agents_are_pruned_without_touching_active_agents(monkeypatch):
    main.API_STATE["agents"] = {
        "old": {"phase": "Deleted", "_finished_monotonic": 1},
        "active": {"phase": "Running"},
    }
    monkeypatch.setattr(main.time, "monotonic", lambda: main.AGENT_RETENTION_S + 2)

    assert main._prune_agents() == 1
    assert "old" not in main.API_STATE["agents"]
    assert "active" in main.API_STATE["agents"]


def test_control_session_protects_public_evil_dog_endpoints(monkeypatch):
    monkeypatch.setattr(main, "ALLOW_UNAUTHENTICATED", False)
    monkeypatch.setattr(main, "CONTROL_TOKEN", "test-control-token")
    # HTTPS is intentional: the production cookie is Secure and therefore must
    # not be accepted over a plain HTTP test origin.
    with TestClient(main.app, base_url="https://testserver") as client:
        assert client.get("/api/evildog/stats").status_code == 401
        assert client.post("/api/evildog/session", json={"token": "wrong"}).status_code == 403

        created = client.post("/api/evildog/session", json={"token": "test-control-token"})
        assert created.status_code == 200
        assert "HttpOnly" in created.headers["set-cookie"]
        assert "Secure" in created.headers["set-cookie"]
        assert "SameSite=strict" in created.headers["set-cookie"]
        assert client.get("/api/evildog/stats").status_code == 200

        assert client.post("/api/evildog/logout").status_code == 200
        assert client.get("/api/evildog/stats").status_code == 401


def test_control_endpoints_fail_closed_without_token(monkeypatch):
    monkeypatch.setattr(main, "ALLOW_UNAUTHENTICATED", False)
    monkeypatch.setattr(main, "CONTROL_TOKEN", None)
    with TestClient(main.app, base_url="https://testserver") as client:
        assert client.get("/api/evildog/stats").status_code == 503
        assert client.post("/api/evildog/session", json={"token": "anything"}).status_code == 503


def test_telemetry_sequence_and_drops_are_observable():
    telemetry = main.TelemetryBus(ring=5)
    queue = asyncio.Queue(maxsize=1)
    telemetry.subscribers.add(queue)

    telemetry.publish({"message": "first"})
    telemetry.publish({"message": "second"})
    # _fanout normally runs on the event loop; invoke it directly to validate the
    # bounded queue behavior without opening a real SSE connection.
    first, second = telemetry.recent
    telemetry._fanout(first)
    telemetry._fanout(second)

    assert first["seq"] < second["seq"]
    assert telemetry.dropped_events == 1


def test_reset_clears_stale_loot_but_preserves_source_ip():
    main._SPOOF["ip"] = "203.0.113.42"
    main.API_STATE["loot_records"] = [{"cpf": "stale"}]
    main.API_STATE["pix_stolen"] = [{"amount": 1}]
    main.API_STATE["secrets"] = [{"DB_PASSWORD": "stale"}]
    main.API_STATE["compromised"].add("auth-service")
    main.attacker.stats["total_attacks"] = 9
    main.bus.recent.append({"message": "stale take"})

    result = asyncio.run(main.reset_demo_state())

    assert result["ok"] is True
    assert result["source_ip"] == "203.0.113.42"
    assert main.API_STATE["loot_records"] == []
    assert main.API_STATE["pix_stolen"] == []
    assert main.API_STATE["secrets"] == []
    assert main.API_STATE["compromised"] == set()
    assert main.attacker.stats["total_attacks"] == 0
    assert all(event.get("message") != "stale take" for event in main.bus.recent)


def test_new_take_rotates_only_when_current_ip_is_still_denylisted(monkeypatch):
    main._SPOOF["ip"] = "203.0.113.42"
    probes = []

    def fake_probe(ip):
        probes.append(ip)
        return ip != "203.0.113.42"

    def fake_rotate():
        main._SPOOF["ip"] = "203.0.113.43"
        return main._SPOOF["ip"]

    monkeypatch.setattr(main, "_source_ip_is_available", fake_probe)
    monkeypatch.setattr(main, "rotate_source_ip", fake_rotate)

    result = main._ensure_available_source_ip()

    assert probes == ["203.0.113.42", "203.0.113.43"]
    assert result == {
        "status": "ready",
        "source_ip": "203.0.113.43",
        "previous_source_ip": "203.0.113.42",
        "rotated": True,
        "attempts": 2,
    }


def test_new_take_keeps_an_available_ip(monkeypatch):
    main._SPOOF["ip"] = "203.0.113.42"
    rotate = lambda: pytest.fail("available IP must not rotate")
    monkeypatch.setattr(main, "_source_ip_is_available", lambda ip: True)
    monkeypatch.setattr(main, "rotate_source_ip", rotate)

    result = main._ensure_available_source_ip()

    assert result["status"] == "ready"
    assert result["source_ip"] == "203.0.113.42"
    assert result["rotated"] is False


def test_reset_rejects_active_demo():
    main._start_pipeline_state("run-active", "203.0.113.42")

    result = asyncio.run(main.reset_demo_state())

    assert result.status_code == 409
