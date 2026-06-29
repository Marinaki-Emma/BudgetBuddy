-- BudgetBuddy sync server schema (MariaDB)
-- Mirrors the SQLite schema on the client exactly.
-- Run once: mysql -u expense_app -p budget_buddy < schema.sql


CREATE DATABASE IF NOT EXISTS budget_buddy;
USE budget_buddy;

CREATE TABLE IF NOT EXISTS accounts (
    id                 VARCHAR(36)  PRIMARY KEY,
    name               VARCHAR(100) NOT NULL,
    type               ENUM('cash','bank','card','savings','other') NOT NULL DEFAULT 'other',
    currency           VARCHAR(3)   NOT NULL DEFAULT 'EUR',
    starting_balance   DECIMAL(12,2) NOT NULL DEFAULT 0,
    is_archived        TINYINT(1)   NOT NULL DEFAULT 0,
    exclude_from_total TINYINT(1)   NOT NULL DEFAULT 0,
    created_at         VARCHAR(40)  NOT NULL,
    updated_at         VARCHAR(40)  NOT NULL,
    is_deleted         TINYINT(1)   NOT NULL DEFAULT 0,
    dirty              TINYINT(1)   NOT NULL DEFAULT 1,
    last_synced_at     VARCHAR(40)  NULL
);

CREATE TABLE IF NOT EXISTS categories (
    id             VARCHAR(36)  PRIMARY KEY,
    name           VARCHAR(100) NOT NULL,
    kind           ENUM('expense','income') NOT NULL,
    parent_id      VARCHAR(36)  NULL REFERENCES categories(id),
    icon           VARCHAR(50)  NULL,
    color          VARCHAR(7)   NULL,
    is_archived    TINYINT(1)   NOT NULL DEFAULT 0,
    created_at     VARCHAR(40)  NOT NULL,
    updated_at     VARCHAR(40)  NOT NULL,
    is_deleted     TINYINT(1)   NOT NULL DEFAULT 0,
    dirty          TINYINT(1)   NOT NULL DEFAULT 1,
    last_synced_at VARCHAR(40)  NULL
);

CREATE TABLE IF NOT EXISTS budgets (
    id             VARCHAR(36)   PRIMARY KEY,
    category_id    VARCHAR(36)   NULL REFERENCES categories(id),
    month          VARCHAR(7)    NOT NULL,
    amount         DECIMAL(12,2) NOT NULL,
    created_at     VARCHAR(40)   NOT NULL,
    updated_at     VARCHAR(40)   NOT NULL,
    is_deleted     TINYINT(1)    NOT NULL DEFAULT 0,
    dirty          TINYINT(1)    NOT NULL DEFAULT 1,
    last_synced_at VARCHAR(40)   NULL,
    UNIQUE KEY uq_budget_category_month (category_id, month)
);

CREATE TABLE IF NOT EXISTS recurring_templates (
    id             VARCHAR(36)   PRIMARY KEY,
    name           VARCHAR(100)  NOT NULL,
    type           ENUM('expense','income') NOT NULL,
    account_id     VARCHAR(36)   NULL REFERENCES accounts(id),
    category_id    VARCHAR(36)   NULL REFERENCES categories(id),
    amount         DECIMAL(12,2) NOT NULL,
    currency       VARCHAR(3)    NOT NULL DEFAULT 'EUR',
    day_of_month   TINYINT       NOT NULL,
    is_active      TINYINT(1)    NOT NULL DEFAULT 1,
    created_at     VARCHAR(40)   NOT NULL,
    updated_at     VARCHAR(40)   NOT NULL,
    is_deleted     TINYINT(1)    NOT NULL DEFAULT 0,
    dirty          TINYINT(1)    NOT NULL DEFAULT 1,
    last_synced_at VARCHAR(40)   NULL
);

CREATE TABLE IF NOT EXISTS transactions (
    id                    VARCHAR(36)   PRIMARY KEY,
    type                  ENUM('expense','income','transfer') NOT NULL,
    account_id            VARCHAR(36)   NULL REFERENCES accounts(id),
    from_account_id       VARCHAR(36)   NULL REFERENCES accounts(id),
    to_account_id         VARCHAR(36)   NULL REFERENCES accounts(id),
    category_id           VARCHAR(36)   NULL REFERENCES categories(id),
    amount                DECIMAL(12,2) NOT NULL,
    currency              VARCHAR(3)    NOT NULL DEFAULT 'EUR',
    occurred_at           VARCHAR(10)   NOT NULL,
    note                  VARCHAR(255)  NULL,
    recurring_template_id VARCHAR(36)   NULL REFERENCES recurring_templates(id),
    created_at            VARCHAR(40)   NOT NULL,
    updated_at            VARCHAR(40)   NOT NULL,
    is_deleted            TINYINT(1)    NOT NULL DEFAULT 0,
    dirty                 TINYINT(1)    NOT NULL DEFAULT 1,
    last_synced_at        VARCHAR(40)   NULL,
    CONSTRAINT chk_transaction_shape CHECK (
        (type IN ('expense','income') AND account_id IS NOT NULL
            AND from_account_id IS NULL AND to_account_id IS NULL)
        OR
        (type = 'transfer' AND account_id IS NULL
            AND from_account_id IS NOT NULL AND to_account_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_transactions_account     ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_from_acct   ON transactions(from_account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_to_acct     ON transactions(to_account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category    ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_occurred_at ON transactions(occurred_at);
CREATE INDEX IF NOT EXISTS idx_transactions_updated_at  ON transactions(updated_at);

CREATE TABLE IF NOT EXISTS local_meta (
    `key`  VARCHAR(100) PRIMARY KEY,
    value  TEXT         NOT NULL
);

-- Tracks which device last synced and when
CREATE TABLE IF NOT EXISTS device_sync_state (
    device_id      VARCHAR(100) PRIMARY KEY,
    last_synced_at VARCHAR(40)  NOT NULL
);