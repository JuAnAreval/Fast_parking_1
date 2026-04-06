  USE railway;

  DROP TABLE IF EXISTS usuarios;
  CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    telefono VARCHAR(20) NULL,
    password VARCHAR(255) NOT NULL,
    rol VARCHAR(20) NOT NULL DEFAULT 'user',
    email_verificado TINYINT(1) NOT NULL DEFAULT 0,
    verification_token_hash VARCHAR(255) NULL,
    verification_token_expires_at DATETIME NULL,
    email_verificado_en DATETIME NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_usuarios_verification_token_hash (verification_token_hash)
  );

  DROP TABLE IF EXISTS parqueaderos;
  CREATE TABLE parqueaderos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    direccion VARCHAR(150) NOT NULL,
    cupos INT NOT NULL DEFAULT 0,
    disponible BOOLEAN NOT NULL DEFAULT TRUE,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    latitud DECIMAL(10, 7) NOT NULL,
    longitud DECIMAL(10, 7) NOT NULL,
    email_verificado TINYINT(1) NOT NULL DEFAULT 0,
    verification_token_hash VARCHAR(255) NULL,
    verification_token_expires_at DATETIME NULL,
    email_verificado_en DATETIME NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_parqueaderos_verification_token_hash (verification_token_hash)
  );

  DROP TABLE IF EXISTS tarifas;
  CREATE TABLE tarifas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    parqueadero_id INT NOT NULL,
    tipo_vehiculo ENUM('camion', 'ambulancia', 'carro', 'moto', 'bicicleta') NOT NULL,
    tarifa_primera_hora DECIMAL(10,2) NOT NULL,
    tarifa_hora_adicional DECIMAL(10,2) NOT NULL,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_tarifa_parqueadero_tipo (parqueadero_id, tipo_vehiculo),
    CONSTRAINT fk_tarifa_parqueadero
      FOREIGN KEY (parqueadero_id) REFERENCES parqueaderos(id)
      ON DELETE CASCADE
  );

  DROP TABLE IF EXISTS vehiculos;
  CREATE TABLE vehiculos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    tipo ENUM('carro', 'moto', 'bicicleta', 'camion', 'ambulancia') NOT NULL,
    placa VARCHAR(15) NOT NULL UNIQUE,
    color VARCHAR(30) NOT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_vehiculo_usuario
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
      ON DELETE CASCADE
  );

  DROP TABLE IF EXISTS reservas;
  CREATE TABLE reservas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    parqueadero_id INT NOT NULL,
    vehiculo_id INT NULL,
    fecha_reserva DATE NOT NULL,
    hora_inicio TIME,
    hora_fin TIME,
    tipo_vehiculo ENUM('carro', 'moto', 'bicicleta', 'camion', 'ambulancia') DEFAULT 'carro',
    estado ENUM('pendiente', 'activa', 'cancelada', 'completada') DEFAULT 'pendiente',
    tiempo_total DECIMAL(5,2) DEFAULT 0.00,
    valor_estimado DECIMAL(10,2) DEFAULT 0.00,
    observaciones TEXT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_reserva_usuario
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
      ON DELETE CASCADE,
    CONSTRAINT fk_reserva_parqueadero
      FOREIGN KEY (parqueadero_id) REFERENCES parqueaderos(id)
      ON DELETE CASCADE,
    CONSTRAINT fk_reserva_vehiculo
      FOREIGN KEY (vehiculo_id) REFERENCES vehiculos(id)
      ON DELETE SET NULL
  );
