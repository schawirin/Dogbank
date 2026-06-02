-- =============================================================================
-- Reset de senhas para garantir consistência no ambiente de demo
-- Garante que todos os usuários têm senha '123456' em plain text
-- para funcionar com a validação do auth-service
-- =============================================================================

DO $$
BEGIN
    -- Reset senhas para plain text '123456' para todos os usuários de demo
    UPDATE usuarios SET senha = '123456'
    WHERE cpf IN (
        '12345678915', -- Vitoria Itadori
        '98765432101', -- Pedro Silva
        '45678912302', -- João Santos
        '78912345603', -- Emiliano Costa
        '32165498704', -- Eliane Oliveira
        '65498732105', -- Patricia Souza
        '15975385206', -- Renato Almeida
        '66666666666', -- Usuario Teste
        '11122233344', -- Carlos Magnata
        '55566677788'  -- Maria Empresaria
    );

    RAISE NOTICE '✅ Senhas resetadas para 123456 (% usuarios atualizados)', (
        SELECT COUNT(*) FROM usuarios
        WHERE cpf IN (
            '12345678915','98765432101','45678912302','78912345603','32165498704',
            '65498732105','15975385206','66666666666','11122233344','55566677788'
        )
    );
END $$;
