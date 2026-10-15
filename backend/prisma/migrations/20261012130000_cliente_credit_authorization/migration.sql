ALTER TABLE [Cliente]
ADD [HabilitadoCredito] BIT NOT NULL
    CONSTRAINT [DF_Cliente_HabilitadoCredito] DEFAULT 0;
