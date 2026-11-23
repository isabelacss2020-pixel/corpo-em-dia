-- Apaga todos os registros e volta o perfil ao estado inicial.
DELETE FROM exercicios;
DELETE FROM treinos;
DELETE FROM pesagens;
UPDATE perfil
   SET nome = '', idade = NULL, altura_cm = NULL, meta_peso_kg = NULL,
       meta_semanal = 3, modo_exemplo = 0
 WHERE id = 1;
