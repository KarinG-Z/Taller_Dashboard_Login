const API_LOGIN = "https://dummyjson.com/auth/login";
const API_USUARIOS = "https://dummyjson.com/users/filter";
const PAGINA_DASHBOARD = "index_api.html";

/* Si ya hay una sesión guardada, no tiene sentido mostrar el login */
if (localStorage.getItem("token")) {
  window.location.replace(PAGINA_DASHBOARD);
}

function mostrarMensaje(texto, tipo, id) {
  const mensaje = document.getElementById(id || "mensaje");
  mensaje.innerText = texto;
  mensaje.className = "login-mensaje " + (tipo || "");
}

function alternarPassword(idCampo, idBoton) {
  const campo = document.getElementById(idCampo || "password");
  const boton = document.getElementById(idBoton || "btnVer");
  const visible = campo.type === "text";

  campo.type = visible ? "password" : "text";
  boton.innerText = visible ? "Mostrar" : "Ocultar";
  boton.setAttribute("aria-pressed", String(!visible));
}

function usarCuentaDemo() {
  document.getElementById("usuario").value = "emilys";
  document.getElementById("password").value = "emilyspass";
  mostrarMensaje("", "");
}

async function iniciarSesion(evento) {
  // El formulario llama a esta función con el evento: evitamos que recargue la página
  if (evento) evento.preventDefault();

  const usuario = document.getElementById("usuario").value.trim();
  const password = document.getElementById("password").value;
  const boton = document.getElementById("btnIngresar");

  if (usuario === "" || password === "") {
    mostrarMensaje("Debe completar todos los campos.", "error");
    return;
  }

  try {
    boton.disabled = true;
    mostrarMensaje("Validando usuario...", "info");

    const respuesta = await fetch(API_LOGIN, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: usuario,
        password: password,
        expiresInMins: 30
      })
    });

    if (!respuesta.ok) {
      throw new Error("Credenciales incorrectas");
    }

    const datos = await respuesta.json();
    console.log(datos);

    localStorage.setItem("token", datos.accessToken);

    localStorage.setItem(
      "usuario",
      JSON.stringify({
        id: datos.id,
        username: datos.username,
        firstName: datos.firstName,
        lastName: datos.lastName,
        email: datos.email,
        image: datos.image
      })
    );

    mostrarMensaje("Inicio de sesión correcto.", "ok");
    window.location.href = PAGINA_DASHBOARD;

  } catch (error) {
    console.error(error);

    if (error instanceof TypeError) {
      // fetch lanza TypeError cuando no hay conexión
      mostrarMensaje("No se pudo conectar. Revise su internet e intente de nuevo.", "error");
    } else {
      mostrarMensaje("Usuario o contraseña incorrectos.", "error");
    }

    boton.disabled = false;
  }
}


/* ==========================================================
   RECUPERAR CONTRASEÑA (simulada)
   DummyJSON no envía correos ni cambia contraseñas, así que:
   1) se comprueba que la cuenta exista con /users/filter,
   2) el código de verificación se genera en el navegador y se
      muestra en pantalla (modo demostración),
   3) el cambio de contraseña es solo una simulación.
   ========================================================== */
let recuperacion = { encontrada: false, usuario: "", correo: "", codigo: "", intentos: 0 };

function mostrarVista(vista) {
  const recuperar = vista === "recuperar";
  document.getElementById("vista-login").hidden = recuperar;
  document.getElementById("vista-recuperar").hidden = !recuperar;

  if (recuperar) {
    irAPaso(1);
    document.getElementById("rec-id").value = document.getElementById("usuario").value.trim();
    document.getElementById("rec-id").focus();
  } else {
    document.getElementById("usuario").focus();
  }
}

function irAPaso(numero) {
  [1, 2, 3].forEach(function (n) {
    document.getElementById("rec-form-" + n).hidden = n !== numero;
    document.getElementById("paso-" + n).classList.toggle("hecho", n <= numero);
  });
  mostrarMensaje("", "", "rec-mensaje");
}

function enmascararCorreo(correo) {
  const partes = correo.split("@");
  return partes[0].charAt(0) + "***@" + partes[1];
}

function generarCodigo() {
  // 6 dígitos con generador criptográfico del navegador
  return String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
}

async function recuperarPaso1(evento) {
  evento.preventDefault();

  const texto = document.getElementById("rec-id").value.trim();
  const boton = document.getElementById("rec-btn-1");

  if (texto === "") {
    mostrarMensaje("Escribe tu usuario o tu correo.", "error", "rec-mensaje");
    return;
  }

  try {
    boton.disabled = true;
    mostrarMensaje("Buscando tu cuenta...", "info", "rec-mensaje");

    const clave = texto.includes("@") ? "email" : "username";
    const url = API_USUARIOS + "?key=" + clave + "&value=" + encodeURIComponent(texto) + "&select=username,email";
    const respuesta = await fetch(url);
    if (!respuesta.ok) throw new Error("Error " + respuesta.status);

    const datos = await respuesta.json();
    const cuenta = datos.users && datos.users[0];

    recuperacion = {
      encontrada: Boolean(cuenta),
      usuario: cuenta ? cuenta.username : "",
      correo: cuenta ? cuenta.email : "",
      codigo: cuenta ? generarCodigo() : "",
      intentos: 0
    };

    // Mensaje genérico: no revela si la cuenta existe (buena práctica de seguridad)
    document.getElementById("rec-info").textContent =
      "Si los datos coinciden con una cuenta, enviamos un código de 6 dígitos a " +
      (cuenta ? enmascararCorreo(cuenta.email) : "tu correo") + ".";

    document.getElementById("rec-demo").innerHTML = cuenta
      ? "Modo demostración: no se envían correos reales. Tu código es <strong>" + recuperacion.codigo + "</strong>"
      : "Modo demostración: no existe una cuenta con esos datos, por eso no se generó ningún código.";

    document.getElementById("rec-codigo").value = "";
    irAPaso(2);
    document.getElementById("rec-codigo").focus();

  } catch (error) {
    console.error(error);
    mostrarMensaje("No se pudo conectar. Revise su internet e intente de nuevo.", "error", "rec-mensaje");
  } finally {
    boton.disabled = false;
  }
}

function recuperarPaso2(evento) {
  evento.preventDefault();

  const codigo = document.getElementById("rec-codigo").value.trim();

  if (!/^\d{6}$/.test(codigo)) {
    mostrarMensaje("El código tiene 6 dígitos.", "error", "rec-mensaje");
    return;
  }

  if (recuperacion.encontrada && codigo === recuperacion.codigo) {
    irAPaso(3);
    document.getElementById("rec-pass").focus();
    return;
  }

  recuperacion.intentos += 1;
  if (recuperacion.intentos >= 3) {
    irAPaso(1);
    mostrarMensaje("Demasiados intentos. Solicita un nuevo código.", "error", "rec-mensaje");
    return;
  }
  mostrarMensaje("Código incorrecto. Te quedan " + (3 - recuperacion.intentos) + " intento(s).", "error", "rec-mensaje");
}

// Puntúa la contraseña de 0 a 4 según longitud, mayúsculas/minúsculas, números y símbolos
function puntuarPassword(texto) {
  let puntos = 0;
  if (texto.length >= 8) puntos++;
  if (/[a-z]/.test(texto) && /[A-Z]/.test(texto)) puntos++;
  if (/\d/.test(texto)) puntos++;
  if (/[^A-Za-z0-9]/.test(texto)) puntos++;
  return puntos;
}

function evaluarFuerza() {
  const texto = document.getElementById("rec-pass").value;
  const nivel = texto === "" ? 0 : Math.max(1, puntuarPassword(texto));
  const etiquetas = ["escribe una contraseña", "débil", "regular", "buena", "excelente"];

  document.getElementById("rec-fuerza").dataset.nivel = nivel;
  document.getElementById("rec-fuerza-txt").textContent = "Seguridad: " + etiquetas[nivel];
}

function recuperarPaso3(evento) {
  evento.preventDefault();

  const clave = document.getElementById("rec-pass").value;
  const confirmar = document.getElementById("rec-pass2").value;

  if (clave.length < 8 || !/[a-z]/.test(clave) || !/[A-Z]/.test(clave) || !/\d/.test(clave)) {
    mostrarMensaje("La contraseña debe tener 8 caracteres, mayúscula, minúscula y número.", "error", "rec-mensaje");
    return;
  }
  if (clave !== confirmar) {
    mostrarMensaje("Las contraseñas no coinciden.", "error", "rec-mensaje");
    return;
  }

  // Aquí un backend real guardaría la nueva contraseña (con hash). En esta práctica solo se simula.
  const usuarioRecuperado = recuperacion.usuario;
  recuperacion = { encontrada: false, usuario: "", correo: "", codigo: "", intentos: 0 };
  document.getElementById("rec-pass").value = "";
  document.getElementById("rec-pass2").value = "";
  evaluarFuerza();

  mostrarVista("login");
  document.getElementById("usuario").value = usuarioRecuperado;
  document.getElementById("password").value = "";
  mostrarMensaje("Contraseña actualizada (simulación). Ya puedes iniciar sesión.", "ok");
  document.getElementById("password").focus();
}

/* Si el dashboard nos envió aquí porque la sesión venció, lo explicamos */
if (new URLSearchParams(window.location.search).get("sesion") === "expirada") {
  mostrarMensaje("Tu sesión expiró. Inicia sesión de nuevo.", "info");
}
