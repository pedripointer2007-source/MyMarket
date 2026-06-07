<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, GET");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

// Credenciales de conexión local por defecto (XAMPP)
// Credenciales de conexión reales en InfinityFree
$host = "sql312.byetcluster.com";
$db_name = "if0_42111191_mymarket";
$username = "if0_42111191";
$password = "453038453038";

try {
    $conn = new PDO("mysql:host=" . $host . ";dbname=" . $db_name . ";charset=utf8", $username, $password);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch(PDOException $exception) {
    echo json_encode(["error" => "Error de conexión: " . $exception->getMessage()]);
    exit();
}

// Leer la acción solicitada por JavaScript
$action = isset($_GET['action']) ? $_GET['action'] : '';

switch($action) {
    case 'get_products':
        // Obtener productos reales de phpMyAdmin
        $query = "SELECT * FROM productos";
        $stmt = $conn->prepare($query);
        $stmt->execute();
        $products = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($products);
        break;

    case 'register':
        // Registrar un nuevo usuario
        $data = json_decode(file_get_contents("php://input"));
        if (empty($data->nombre) || empty($data->email) || empty($data->password)) {
            echo json_encode(["success" => false, "message" => "Por favor completa todos los campos de registro."]);
            break;
        }
        // Validar si el email ya existe
        $check = $conn->prepare("SELECT id FROM usuarios WHERE email = ?");
        $check->execute([$data->email]);
        if($check->rowCount() > 0) {
            echo json_encode(["success" => false, "message" => "El correo ya está registrado."]);
            break;
        }
        // Encriptar contraseña por seguridad antes de guardarla
        $pass_hash = password_hash($data->password, PASSWORD_BCRYPT);
        $query = "INSERT INTO usuarios (nombre, email, password) VALUES (?, ?, ?)";
        $stmt = $conn->prepare($query);
        if($stmt->execute([$data->nombre, $data->email, $pass_hash])) {
            echo json_encode(["success" => true, "message" => "Usuario registrado."]);
        } else {
            echo json_encode(["success" => false, "message" => "No se pudo registrar."]);
        }
        break;

    case 'login':
        // Iniciar sesión verificando la base de datos
        $data = json_decode(file_get_contents("php://input"));
        if (empty($data->email) || empty($data->password)) {
            echo json_encode(["success" => false, "message" => "Correo y contraseña son requeridos."]);
            break;
        }
        $query = "SELECT * FROM usuarios WHERE email = ?";
        $stmt = $conn->prepare($query);
        $stmt->execute([$data->email]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if($user && password_verify($data->password, $user['password'])) {
            // No devolvemos el password al frontend por seguridad
            unset($user['password']);
            echo json_encode(["success" => true, "user" => $user]);
        } else {
            echo json_encode(["success" => false, "message" => "Credenciales incorrectas."]);
        }
        break;

    case 'checkout':
        // Procesar la compra de forma transaccional
        $data = json_decode(file_get_contents("php://input"));
        if (empty($data->items) || empty($data->total)) {
            echo json_encode(["success" => false, "message" => "Datos de compra incompletos."]);
            break;
        }
        // Aquí recibirías el id_usuario, total y los items del carrito para insertarlos
        // en las tablas 'ordenes' y 'detalle_ordenes' usando $conn->beginTransaction()
        echo json_encode(["success" => true, "message" => "Simulación de orden procesada en BD."]);
        break;

    default:
        echo json_encode(["success" => false, "message" => "Acción no válida."]);
        break;
}
?>