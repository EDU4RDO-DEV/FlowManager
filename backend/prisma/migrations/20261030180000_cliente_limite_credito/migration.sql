ALTER TABLE [Cliente]
ADD [LimiteCredito] DECIMAL(10, 2) NOT NULL
    CONSTRAINT [DF_Cliente_LimiteCredito] DEFAULT 0;
