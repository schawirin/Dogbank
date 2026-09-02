package com.dogbank.transaction.exception;

/** Indicates that auth-service intentionally denied an operation for a remediated account. */
public class UserBlockedException extends RuntimeException {
    public UserBlockedException() {
        super("Conta bloqueada por atividade suspeita");
    }
}
