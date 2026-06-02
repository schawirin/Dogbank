#!/usr/bin/env python3
"""
DogBank README Scenario Load Worker
===================================
Runs a steady stream of PIX scenarios from the project README so Datadog has
continuous APM, logs, errors, and RUM-adjacent backend activity during demos.
"""

import json
import logging
import os
import random
import time
from dataclasses import dataclass
from typing import Callable, Optional

import requests


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("dogbank.pix_cron")


AUTH_SERVICE_URL = os.getenv("AUTH_SERVICE_URL", "http://auth-service:8088")
TRANSACTION_SERVICE_URL = os.getenv("TRANSACTION_SERVICE_URL", "http://transaction-service:8084")

STARTUP_DELAY = float(os.getenv("STARTUP_DELAY", "15"))
MIN_INTERVAL = float(os.getenv("MIN_INTERVAL", "10"))
MAX_INTERVAL = float(os.getenv("MAX_INTERVAL", "25"))
MAX_TRANSACTIONS = int(os.getenv("MAX_TRANSACTIONS", "0"))
REQUEST_TIMEOUT = float(os.getenv("REQUEST_TIMEOUT", "45"))
RUN_ID = os.getenv("DOGBANK_LOAD_RUN_ID") or time.strftime("dogbank-pix-%Y%m%d-%H%M%S")
BURST_COUNT = int(os.getenv("BURST_COUNT", os.getenv("DOGBANK_LOAD_BURST_COUNT", "0")))
BURST_INTERVAL = float(os.getenv("BURST_INTERVAL", os.getenv("DOGBANK_LOAD_BURST_INTERVAL", "0.4")))

SCENARIO_WEIGHTS = {
    "success": float(os.getenv("PROB_SUCCESS", "0.35")),
    "invalid_pix_key": float(os.getenv("PROB_INVALID_PIX_KEY", "0.15")),
    "insufficient_balance": float(os.getenv("PROB_INSUFFICIENT_BALANCE", "0.10")),
    "self_transfer": float(os.getenv("PROB_SELF_TRANSFER", "0.08")),
    "bc_timeout": float(os.getenv("PROB_BC_TIMEOUT", "0.08")),
    "bc_internal_error": float(os.getenv("PROB_BC_INTERNAL_ERROR", "0.05")),
    "limit_exceeded": float(os.getenv("PROB_LIMIT_EXCEEDED", "0.07")),
    "spi_timeout": float(os.getenv("PROB_SPI_TIMEOUT", "0.05")),
    "spi_internal_error": float(os.getenv("PROB_SPI_INTERNAL_ERROR", "0.04")),
    "spi_limit_exceeded": float(os.getenv("PROB_SPI_LIMIT_EXCEEDED", "0.03")),
}
FORCE_COVERAGE = os.getenv("DOGBANK_LOAD_FORCE_COVERAGE", "1").lower() not in {"0", "false", "no"}


@dataclass(frozen=True)
class DogBankUser:
    cpf: str
    password: str
    name: str
    pix_key: str
    account_id: Optional[int] = None


README_USERS = [
    DogBankUser("12345678915", "123456", "Vitoria Itadori", "vitoria.itadori@dogbank.com"),
    DogBankUser("98765432101", "123456", "Pedro Silva", "pedro.silva@dogbank.com"),
    DogBankUser("45678912302", "123456", "Joao Santos", "joao.santos@dogbank.com"),
    DogBankUser("78912345603", "123456", "Emiliano Costa", "emiliano.costa@dogbank.com"),
    DogBankUser("32165498704", "123456", "Eliane Oliveira", "eliane.oliveira@dogbank.com"),
    DogBankUser("65498732105", "123456", "Patricia Souza", "patricia.souza@dogbank.com"),
    DogBankUser("15975385206", "123456", "Renato Almeida", "renato.almeida@dogbank.com"),
    DogBankUser("66666666666", "123456", "Usuario Teste", "teste@dogbank.com"),
]


class PixScenarioWorker:
    def __init__(self) -> None:
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "DogBankLoadCron/1.0",
            "X-Demo-Load": "dogbank-readme-scenarios",
            "X-DogBank-Load-Run-Id": RUN_ID,
            "X-DogBank-Client": "pix-cron",
        })
        self.users_by_cpf: dict[str, DogBankUser] = {user.cpf: user for user in README_USERS}
        self.stats = {name: 0 for name in SCENARIO_WEIGHTS}
        self.stats.update({"total": 0, "expected": 0, "unexpected": 0})
        self.sequence = 0

    def login(self, user: DogBankUser) -> Optional[DogBankUser]:
        if user.account_id is not None:
            return user

        response = self.session.post(
            f"{AUTH_SERVICE_URL}/api/auth/login",
            json={"cpf": user.cpf, "senha": user.password},
            timeout=REQUEST_TIMEOUT,
            headers={
                "X-DogBank-Scenario": "login",
                "X-DogBank-Load-Run-Id": RUN_ID,
            },
        )

        if response.status_code != 200:
            self.log_result(
                scenario="login",
                source=user,
                destination=None,
                amount=0,
                expected_success=False,
                response=response,
                error="login failed",
            )
            return None

        data = response.json()
        account_id = data.get("accountId")
        if account_id is None:
            logger.warning("Login response without accountId for %s: %s", user.name, data)
            return None

        hydrated = DogBankUser(user.cpf, user.password, user.name, user.pix_key, int(account_id))
        self.users_by_cpf[user.cpf] = hydrated
        logger.info("login_ok user=%s account_id=%s", hydrated.name, hydrated.account_id)
        return hydrated

    def warm_up(self) -> None:
        logger.info("warming_up users=%s", len(README_USERS))
        for user in README_USERS:
            try:
                self.login(user)
            except Exception as exc:
                logger.warning("warmup_login_failed user=%s error=%s", user.name, exc)

    def pick_user(self, *, exclude: Optional[DogBankUser] = None) -> DogBankUser:
        users = list(self.users_by_cpf.values())
        if exclude is not None:
            users = [user for user in users if user.cpf != exclude.cpf]
        return random.choice(users)

    def post_pix(
        self,
        *,
        scenario: str,
        source: DogBankUser,
        destination_pix_key: str,
        amount: float,
        expected_success: bool,
        destination: Optional[DogBankUser] = None,
    ) -> bool:
        source = self.login(source) or source
        if source.account_id is None:
            self.log_result(
                scenario=scenario,
                source=source,
                destination=destination,
                amount=amount,
                expected_success=expected_success,
                response=None,
                error="missing account id",
            )
            return False

        payload = {
            "accountOriginId": source.account_id,
            "pixKeyDestination": destination_pix_key,
            "amount": amount,
            "description": f"dogbank-load:{scenario}",
            "password": source.password,
        }

        try:
            response = self.session.post(
                f"{TRANSACTION_SERVICE_URL}/api/transactions/pix",
                json=payload,
                timeout=REQUEST_TIMEOUT,
                headers={
                    "X-DogBank-Scenario": scenario,
                    "X-DogBank-Load-Run-Id": RUN_ID,
                    "X-DogBank-Source-Account": str(source.account_id),
                    "X-DogBank-Expected-Success": str(expected_success).lower(),
                },
            )
            observed_success = 200 <= response.status_code < 300
            self.log_result(
                scenario=scenario,
                source=source,
                destination=destination,
                amount=amount,
                expected_success=expected_success,
                response=response,
                error=None,
            )
            return observed_success == expected_success
        except Exception as exc:
            self.log_result(
                scenario=scenario,
                source=source,
                destination=destination,
                amount=amount,
                expected_success=expected_success,
                response=None,
                error=str(exc),
            )
            return not expected_success

    def scenario_success(self) -> bool:
        source = self.pick_user()
        destination = self.pick_user(exclude=source)
        amount = round(random.uniform(5, 75), 2)
        if amount in (100.0, 1000.0):
            amount = 42.42
        return self.post_pix(
            scenario="success",
            source=source,
            destination=destination,
            destination_pix_key=destination.pix_key,
            amount=amount,
            expected_success=True,
        )

    def scenario_invalid_pix_key(self) -> bool:
        source = self.pick_user()
        return self.post_pix(
            scenario="invalid_pix_key",
            source=source,
            destination=None,
            destination_pix_key="invalid@email.com",
            amount=12.34,
            expected_success=False,
        )

    def scenario_insufficient_balance(self) -> bool:
        source = self.users_by_cpf["15975385206"]
        destination = self.users_by_cpf["98765432101"]
        return self.post_pix(
            scenario="insufficient_balance",
            source=source,
            destination=destination,
            destination_pix_key=destination.pix_key,
            amount=10000.00,
            expected_success=False,
        )

    def scenario_self_transfer(self) -> bool:
        source = self.users_by_cpf["66666666666"]
        return self.post_pix(
            scenario="self_transfer",
            source=source,
            destination=source,
            destination_pix_key=source.pix_key,
            amount=25.00,
            expected_success=False,
        )

    def scenario_bc_timeout(self) -> bool:
        source = self.pick_user()
        destination = self.pick_user(exclude=source)
        return self.post_pix(
            scenario="bc_timeout",
            source=source,
            destination=destination,
            destination_pix_key=destination.pix_key,
            amount=100.00,
            expected_success=False,
        )

    def scenario_limit_exceeded(self) -> bool:
        source = self.pick_user()
        destination = self.pick_user(exclude=source)
        return self.post_pix(
            scenario="limit_exceeded",
            source=source,
            destination=destination,
            destination_pix_key=destination.pix_key,
            amount=1000.00,
            expected_success=False,
        )

    def scenario_bc_internal_error(self) -> bool:
        source = self.pick_user()
        destination = self.pick_user(exclude=source)
        return self.post_pix(
            scenario="bc_internal_error",
            source=source,
            destination=destination,
            destination_pix_key=destination.pix_key,
            amount=666.66,
            expected_success=False,
        )

    def scenario_spi_timeout(self) -> bool:
        source = self.pick_user()
        destination = self.pick_user(exclude=source)
        return self.post_pix(
            scenario="spi_timeout",
            source=source,
            destination=destination,
            destination_pix_key=destination.pix_key,
            amount=101.01,
            expected_success=False,
        )

    def scenario_spi_internal_error(self) -> bool:
        source = self.pick_user()
        destination = self.pick_user(exclude=source)
        return self.post_pix(
            scenario="spi_internal_error",
            source=source,
            destination=destination,
            destination_pix_key=destination.pix_key,
            amount=606.66,
            expected_success=False,
        )

    def scenario_spi_limit_exceeded(self) -> bool:
        source = self.pick_user()
        destination = self.pick_user(exclude=source)
        return self.post_pix(
            scenario="spi_limit_exceeded",
            source=source,
            destination=destination,
            destination_pix_key=destination.pix_key,
            amount=100001.00,
            expected_success=False,
        )

    def choose_scenario(self) -> str:
        names = list(SCENARIO_WEIGHTS.keys())
        weights = [SCENARIO_WEIGHTS[name] for name in names]
        if sum(weights) <= 0:
            return "success"
        return random.choices(names, weights=weights, k=1)[0]

    def run_scenario(self, scenario_name: str) -> None:
        runner: Callable[[], bool] = getattr(self, f"scenario_{scenario_name}")
        self.sequence += 1
        self.stats["total"] += 1
        self.stats[scenario_name] += 1

        matched_expectation = runner()
        if matched_expectation:
            self.stats["expected"] += 1
        else:
            self.stats["unexpected"] += 1

    def run_once(self) -> None:
        self.run_scenario(self.choose_scenario())

    def run(self) -> None:
        logger.info(
            "starting_pix_cron run_id=%s auth=%s transaction=%s interval=%.1f-%.1fs max_transactions=%s burst=%s burst_interval=%.2fs weights=%s",
            RUN_ID,
            AUTH_SERVICE_URL,
            TRANSACTION_SERVICE_URL,
            MIN_INTERVAL,
            MAX_INTERVAL,
            MAX_TRANSACTIONS or "infinite",
            BURST_COUNT,
            BURST_INTERVAL,
            json.dumps(SCENARIO_WEIGHTS, sort_keys=True),
        )
        time.sleep(STARTUP_DELAY)
        self.warm_up()

        if FORCE_COVERAGE:
            logger.info(
                "starting_required_coverage %s",
                json.dumps({
                    "event": "dogbank.pix_cron.coverage.started",
                    "run_id": RUN_ID,
                    "scenarios": list(SCENARIO_WEIGHTS.keys()),
                }, sort_keys=True),
            )
            for scenario_name in SCENARIO_WEIGHTS:
                self.run_scenario(scenario_name)
                time.sleep(BURST_INTERVAL)
            logger.info(
                "completed_required_coverage %s",
                json.dumps({
                    "event": "dogbank.pix_cron.coverage.completed",
                    "run_id": RUN_ID,
                    **self.stats,
                }, sort_keys=True),
            )

        if BURST_COUNT > 0 and MAX_TRANSACTIONS <= 0:
            logger.info(
                "starting_initial_burst %s",
                json.dumps({
                    "event": "dogbank.pix_cron.burst.started",
                    "run_id": RUN_ID,
                    "count": BURST_COUNT,
                    "interval_seconds": BURST_INTERVAL,
                }, sort_keys=True),
            )
            for _ in range(BURST_COUNT):
                self.run_once()
                time.sleep(BURST_INTERVAL)
            logger.info(
                "completed_initial_burst %s",
                json.dumps({
                    "event": "dogbank.pix_cron.burst.completed",
                    "run_id": RUN_ID,
                    **self.stats,
                }, sort_keys=True),
            )

        while MAX_TRANSACTIONS <= 0 or self.stats["total"] < MAX_TRANSACTIONS:
            self.run_once()
            if self.stats["total"] % 10 == 0:
                logger.info(
                    "stats %s",
                    json.dumps({
                        "event": "dogbank.pix_cron.stats",
                        "run_id": RUN_ID,
                        **self.stats,
                    }, sort_keys=True),
                )
            time.sleep(random.uniform(MIN_INTERVAL, MAX_INTERVAL))

        logger.info(
            "completed %s",
            json.dumps({
                "event": "dogbank.pix_cron.completed",
                "run_id": RUN_ID,
                **self.stats,
            }, sort_keys=True),
        )

    def log_result(
        self,
        *,
        scenario: str,
        source: DogBankUser,
        destination: Optional[DogBankUser],
        amount: float,
        expected_success: bool,
        response: Optional[requests.Response],
        error: Optional[str],
    ) -> None:
        status_code = response.status_code if response is not None else None
        observed_success = status_code is not None and 200 <= status_code < 300
        payload = {
            "event": "dogbank.pix_cron.result",
            "run_id": RUN_ID,
            "sequence": self.sequence,
            "scenario": scenario,
            "expected_success": expected_success,
            "observed_success": observed_success,
            "matched_expectation": observed_success == expected_success,
            "status_code": status_code,
            "source_cpf": source.cpf,
            "source_name": source.name,
            "source_account_id": source.account_id,
            "destination_pix_key": destination.pix_key if destination else "invalid@email.com",
            "destination_name": destination.name if destination else None,
            "amount": amount,
            "error": error,
        }
        if response is not None and not observed_success:
            payload["response"] = response.text[:500]

        level = logging.INFO if payload["matched_expectation"] else logging.WARNING
        logger.log(level, json.dumps(payload, sort_keys=True))


if __name__ == "__main__":
    PixScenarioWorker().run()
