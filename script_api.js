
const PAGINA_LOGIN = "login.html";
const API_ME = "https://dummyjson.com/auth/me";

function tokenVigente() {
  const token = localStorage.getItem("token");
  if (!token) return false;
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const carga = JSON.parse(atob(base64));
    return !carga.exp || carga.exp * 1000 > Date.now();
  } catch (e) {
    return true; // si no se puede leer, /auth/me decide
  }
}

function cerrarSesion(expirada) {
  localStorage.removeItem("token");
  localStorage.removeItem("usuario");
  // replace() evita que el botón "Atrás" devuelva al dashboard
  window.location.replace(PAGINA_LOGIN + (expirada === true ? "?sesion=expirada" : ""));
}

if (!tokenVigente()) {
  const habiaToken = localStorage.getItem("token") !== null;
  document.documentElement.style.display = "none"; // no mostrar el dashboard 
  cerrarSesion(habiaToken);
}

// Revisa cada minuto si la sesión (30 min) ya venció mientras la página sigue abierta
setInterval(function () {
  if (!tokenVigente()) cerrarSesion(true);
}, 60 * 1000);


window.addEventListener("pageshow", function (e) {
  if (e.persisted && !tokenVigente()) cerrarSesion(true);
});


const API = "https://dummyjson.com/products";
const ENVIO_GRATIS = 50;          // monto desde el cual el envío es gratis
const CAT_FAVORITOS = "__favoritos";

function obtenerUsuario() {
  try {
    return JSON.parse(localStorage.getItem("usuario"));
  } catch (e) {
    return null;
  }
}

function claveUsuario(base) {
  const usuario = obtenerUsuario();
  return base + "_" + (usuario ? usuario.id : "anonimo");
}

function leerDatos(base, porDefecto) {
  try {
    const valor = localStorage.getItem(claveUsuario(base));
    return valor ? JSON.parse(valor) : porDefecto;
  } catch (e) {
    return porDefecto;
  }
}

function guardarDatos(base, valor) {
  try {
    localStorage.setItem(claveUsuario(base), JSON.stringify(valor));
    return true;
  } catch (e) {
    console.warn("No se pudo guardar " + base, e);
    return false;
  }
}

let productos = [];        // todos los productos traídos de la API
let carrito = [];          // [{ id, precio, titulo, imagen, cantidad }]
let favoritos = [];        // ids de productos favoritos del usuario
let pedidos = [];          // historial de compras del usuario
let categoriaActiva = "";  // categoría (pasillo) seleccionada; "" = todas


const ICON_STAR = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.6L22 9.5l-5 4.9 1.2 7.1L12 18.1l-6.2 3.4L7 14.4 2 9.5l7.1-.9z"/></svg>`;
const ICON_HEART = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg>`;
const ICON_BAG_PLUS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8V6a6 6 0 0 1 12 0v2"/><path d="M4 8h16l-1.2 12.2A2 2 0 0 1 16.82 22H7.18a2 2 0 0 1-1.98-1.8L4 8z"/><path d="M12 11v5M9.5 13.5h5"/></svg>`;
const ICON_TRASH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>`;
const ICON_SEARCH_EMPTY = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="6.5"/><path d="M20 20l-4.8-4.8"/></svg>`;
const ICON_BAG_EMPTY = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8V6a6 6 0 0 1 12 0v2"/><path d="M4 8h16l-1.2 12.2A2 2 0 0 1 16.82 22H7.18a2 2 0 0 1-1.98-1.8L4 8z"/></svg>`;


function escaparHTML(texto) {
  return String(texto).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function mostrarToast(texto, tipo) {
  const contenedor = document.getElementById("toasts");
  const aviso = document.createElement("div");
  aviso.className = "toast " + (tipo || "");
  aviso.textContent = texto;
  contenedor.appendChild(aviso);
  setTimeout(function () {
    aviso.classList.add("saliendo");
    setTimeout(function () { aviso.remove(); }, 320);
  }, 3200);
}


async function listarProductos() {
  const contenedor = document.getElementById("resultado");
  contenedor.innerHTML = '<div class="skeleton"></div>'.repeat(8);

  try {
    const respuesta = await fetch(API);
    if (!respuesta.ok) throw new Error("Error " + respuesta.status);
    const datos = await respuesta.json();
    productos = datos.products;
    categoriaActiva = "";
    renderCategorias();
    mostrarProductos(productos);
  } catch (error) {
    contenedor.innerHTML =
      `<div class="sin-resultados">${ICON_SEARCH_EMPTY}<br>No se pudieron cargar los productos. Verifica tu conexión.</div>`;
    console.error("Error al listar productos:", error);
  }
}

function mostrarProductos(lista) {
  const contenedor = document.getElementById("resultado");

  const contadorProd = document.getElementById("contador-productos");
  if (contadorProd) {
    contadorProd.textContent = `Mostrando ${lista.length} producto${lista.length === 1 ? "" : "s"}`;
  }

  if (lista.length === 0) {
    const mensaje = categoriaActiva === CAT_FAVORITOS
      ? "Aún no tienes favoritos.<br>Toca el corazón de un producto para guardarlo aquí."
      : "No se encontraron productos con ese criterio.";
    contenedor.innerHTML = `<div class="sin-resultados">${ICON_SEARCH_EMPTY}<br>${mensaje}</div>`;
    return;
  }

  let resultado = "";
  lista.forEach(producto => {
    const agotado = producto.stock === 0;
    const pocasUnidades = !agotado && producto.stock < 10;
    const esFavorito = favoritos.includes(producto.id);

    resultado += `
      <div class="tarjeta">
        <div class="img-wrap">
          <img src="${producto.thumbnail}" alt="${escaparHTML(producto.title)}" loading="lazy">
          <button type="button" class="fav-btn ${esFavorito ? "activo" : ""}" data-id="${producto.id}"
                  aria-pressed="${esFavorito}"
                  aria-label="${esFavorito ? "Quitar de favoritos" : "Agregar a favoritos"}"
                  onclick="toggleFavorito(${producto.id})">${ICON_HEART}</button>
        </div>
        <div class="tarjeta-body">
          <span class="categoria">${escaparHTML(producto.category.replace(/-/g, " "))}</span>
          <h3>${escaparHTML(producto.title)}</h3>
          <p class="descripcion">${escaparHTML(producto.description)}</p>
          <div class="meta-row">
            <span class="rating">${ICON_STAR} ${producto.rating}</span>
            <span>${agotado ? "Agotado" : "Stock: " + producto.stock}</span>
          </div>
          ${pocasUnidades ? `<span class="etiqueta-stock">¡Últimas unidades!</span>` : ""}
          <p class="precio">$${producto.price.toFixed(2)}</p>
          <button ${agotado ? "disabled" : ""} onclick="agregarCarrito(${producto.id})">
            ${agotado ? "Agotado" : ICON_BAG_PLUS + " Agregar al carrito"}
          </button>
        </div>
      </div>
    `;
  });
  contenedor.innerHTML = resultado;
}

function renderCategorias() {
  const cont = document.getElementById("categorias");
  const unicas = [...new Set(productos.map(p => p.category))];

  let html = `<button class="chip ${categoriaActiva === "" ? "activo" : ""}" onclick="filtrarCategoria('')">Todos</button>`;
  html += `<button class="chip ${categoriaActiva === CAT_FAVORITOS ? "activo" : ""}" onclick="filtrarCategoria('${CAT_FAVORITOS}')">Favoritos<span class="chip-n">${favoritos.length}</span></button>`;
  unicas.forEach(cat => {
    html += `<button class="chip ${categoriaActiva === cat ? "activo" : ""}" onclick="filtrarCategoria('${cat}')">${escaparHTML(cat.replace(/-/g, " "))}</button>`;
  });
  cont.innerHTML = html;
}

function filtrarCategoria(categoria) {
  categoriaActiva = categoria;
  document.getElementById("buscar").value = "";
  document.getElementById("ordenar").value = "";
  renderCategorias();
  mostrarProductos(obtenerListaBase());
}

function obtenerListaBase() {
  if (categoriaActiva === CAT_FAVORITOS) return productos.filter(p => favoritos.includes(p.id));
  if (!categoriaActiva) return productos;
  return productos.filter(p => p.category === categoriaActiva);
}

function toggleFavorito(id) {
  const indice = favoritos.indexOf(id);
  const agregado = indice === -1;

  if (agregado) {
    favoritos.push(id);
  } else {
    favoritos.splice(indice, 1);
  }
  guardarDatos("favoritos", favoritos);
  mostrarToast(agregado ? "Agregado a tus favoritos." : "Quitado de tus favoritos.");

  if (categoriaActiva === CAT_FAVORITOS) {
    mostrarProductos(obtenerListaBase());   // el producto desaparece de la vista
  } else {
    document.querySelectorAll(`.fav-btn[data-id="${id}"]`).forEach(btn => {
      btn.classList.toggle("activo", agregado);
      btn.setAttribute("aria-pressed", String(agregado));
      btn.setAttribute("aria-label", agregado ? "Quitar de favoritos" : "Agregar a favoritos");
    });
  }
  renderCategorias();
}


function buscarProductos() {
  const texto = document.getElementById("buscar").value.toLowerCase();
  const filtrados = obtenerListaBase().filter(p =>
    p.title.toLowerCase().includes(texto)
  );
  mostrarProductos(filtrados);
}

function ordenarProductos() {
  const tipo = document.getElementById("ordenar").value;
  let ordenados = [...obtenerListaBase()];
  if (tipo === "asc") {
    ordenados.sort((a, b) => a.price - b.price);
  } else if (tipo === "desc") {
    ordenados.sort((a, b) => b.price - a.price);
  }
  mostrarProductos(ordenados);
}


function stockDe(id) {
  const producto = productos.find(p => p.id === id);
  return producto ? producto.stock : Infinity;
}


function agregarCarrito(id) {
  const producto = productos.find(p => p.id === id);
  if (!producto) return;

  const existente = carrito.find(item => item.id === id);
  if (existente) {
    if (existente.cantidad >= producto.stock) {
      mostrarToast("Ya tienes todo el stock disponible de este producto.", "error");
      return;
    }
    existente.cantidad += 1;
  } else {
    carrito.push({
      id: producto.id,
      precio: producto.price,
      titulo: producto.title,
      imagen: producto.thumbnail,
      cantidad: 1
    });
  }
  ocultarMensajeCompra();
  actualizarCarrito();
  abrirCarrito();
}

function abrirCarrito() {
  cerrarPerfil();
  document.getElementById("carrito-panel").classList.add("abierto");
  document.getElementById("carrito-overlay").classList.add("visible");
}

function cerrarCarrito() {
  document.getElementById("carrito-panel").classList.remove("abierto");
  document.getElementById("carrito-overlay").classList.remove("visible");
}

function toggleCarrito() {
  const abierto = document.getElementById("carrito-panel").classList.contains("abierto");
  if (abierto) {
    cerrarCarrito();
  } else {
    abrirCarrito();
  }
}

function incrementarCantidad(id) {
  const item = carrito.find(i => i.id === id);
  if (!item) return;
  if (item.cantidad >= stockDe(id)) {
    mostrarToast("Alcanzaste el stock disponible.", "error");
    return;
  }
  item.cantidad += 1;
  actualizarCarrito();
}

function decrementarCantidad(id) {
  const item = carrito.find(i => i.id === id);
  if (!item) return;
  item.cantidad -= 1;
  if (item.cantidad <= 0) {
    carrito = carrito.filter(i => i.id !== id);
  }
  actualizarCarrito();
}

function eliminarCarrito(id) {
  carrito = carrito.filter(item => item.id !== id);
  actualizarCarrito();
}

function vaciarCarrito() {
  carrito = [];
  ocultarMensajeCompra();
  actualizarCarrito();
}

function calcularTotal() {
  return carrito.reduce((acc, item) => acc + item.precio * item.cantidad, 0);
}


function renderEnvio(total) {
  const el = document.getElementById("envio-progreso");
  if (carrito.length === 0) {
    el.innerHTML = "";
    return;
  }
  const porcentaje = Math.min(100, (total / ENVIO_GRATIS) * 100);
  const texto = total >= ENVIO_GRATIS
    ? "<strong>¡Tienes envío gratis!</strong>"
    : `Te faltan <strong>$${(ENVIO_GRATIS - total).toFixed(2)}</strong> para el envío gratis`;

  el.innerHTML = `${texto}<div class="envio-barra"><span style="width:${porcentaje}%"></span></div>`;
}

// actualizar carrito, calcular total y guardar (por usuario) en localStorage
function actualizarCarrito() {
  const listaEl = document.getElementById("carrito");
  const totalEl = document.getElementById("total");
  const contadorEl = document.getElementById("contador-carrito");

  if (carrito.length === 0) {
    listaEl.innerHTML = `<li class="carrito-vacio" style="border:none; display:block;">${ICON_BAG_EMPTY}<br>Tu carrito está vacío.</li>`;
  } else {
    let lista = "";
    carrito.forEach(item => {
      const subtotal = item.precio * item.cantidad;
      lista += `
        <li>
          ${item.imagen ? `<img class="item-thumb" src="${item.imagen}" alt="">` : ""}
          <div class="item-info">
            <strong>${escaparHTML(item.titulo)}</strong>
            <span>$${item.precio.toFixed(2)} c/u</span>
          </div>
          <button class="quitar-btn" onclick="eliminarCarrito(${item.id})" title="Quitar producto" aria-label="Quitar producto">${ICON_TRASH}</button>
          <div class="qty-stepper">
            <button onclick="decrementarCantidad(${item.id})" aria-label="Restar una unidad">–</button>
            <span>${item.cantidad}</span>
            <button onclick="incrementarCantidad(${item.id})" aria-label="Sumar una unidad">+</button>
          </div>
          <span class="subtotal">$${subtotal.toFixed(2)}</span>
        </li>
      `;
    });
    listaEl.innerHTML = lista;
  }

  const total = calcularTotal();
  const totalItems = carrito.reduce((acc, item) => acc + item.cantidad, 0);

  totalEl.innerHTML = `Total <span>$${total.toFixed(2)}</span>`;
  contadorEl.textContent = totalItems;
  renderEnvio(total);

  guardarDatos("carrito", carrito);
}

// recuperar el carrito del usuario al recargar la página
function cargarCarritoGuardado() {
  localStorage.removeItem("carrito"); // clave antigua compartida entre usuarios (ya no se usa)
  carrito = leerDatos("carrito", []);
  favoritos = leerDatos("favoritos", []);
  pedidos = leerDatos("pedidos", []);
  actualizarCarrito();
  actualizarContadorPedidos();
}


function finalizarCompra() {
  if (carrito.length === 0) {
    mostrarMensajeCompra("Tu carrito está vacío. Agrega productos antes de finalizar la compra.", "error");
    return;
  }
  const total = calcularTotal();
  const totalItems = carrito.reduce((acc, item) => acc + item.cantidad, 0);

  pedidos.unshift({
    id: Date.now(),
    fecha: new Date().toISOString(),
    items: carrito.map(i => ({ id: i.id, titulo: i.titulo, precio: i.precio, imagen: i.imagen, cantidad: i.cantidad })),
    total: total,
    envioGratis: total >= ENVIO_GRATIS
  });
  pedidos = pedidos.slice(0, 20); // se conservan los 20 más recientes
  guardarDatos("pedidos", pedidos);
  actualizarContadorPedidos();

  mostrarMensajeCompra(
    `¡Compra realizada con éxito! ${totalItems} producto(s) por un total de $${total.toFixed(2)}.`,
    "exito"
  );

  carrito = [];
  actualizarCarrito();
}

function mostrarMensajeCompra(texto, tipo) {
  const el = document.getElementById("mensaje-compra");
  el.textContent = texto;
  el.className = `mensaje-compra visible ${tipo}`;
  clearTimeout(mostrarMensajeCompra._timer);
  mostrarMensajeCompra._timer = setTimeout(ocultarMensajeCompra, 5000);
}

function ocultarMensajeCompra() {
  const el = document.getElementById("mensaje-compra");
  el.className = "mensaje-compra";
  el.textContent = "";
}

function actualizarContadorPedidos() {
  document.getElementById("contador-pedidos").textContent = pedidos.length;
}

function abrirPedidos() {
  cerrarPerfil();
  const lista = document.getElementById("lista-pedidos");

  if (pedidos.length === 0) {
    lista.innerHTML = `<div class="carrito-vacio">${ICON_BAG_EMPTY}<br>Aún no has realizado compras.</div>`;
  } else {
    lista.innerHTML = pedidos.map(p => {
      const fecha = new Date(p.fecha).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
      const items = p.items.map(i => `<li>${i.cantidad} × ${escaparHTML(i.titulo)}</li>`).join("");
      return `
        <article class="pedido">
          <div class="pedido-top">
            <strong>Pedido #${String(p.id).slice(-6)}</strong>
            <span>${fecha}</span>
          </div>
          <ul>${items}</ul>
          ${p.envioGratis ? '<span class="etiqueta-envio">Envío gratis</span>' : ""}
          <div class="pedido-pie">
            <span class="pedido-total">$${p.total.toFixed(2)}</span>
            <button class="secondary" onclick="repetirPedido(${p.id})">Repetir compra</button>
          </div>
        </article>`;
    }).join("");
  }
  document.getElementById("modal-pedidos").hidden = false;
}

function cerrarPedidos() {
  document.getElementById("modal-pedidos").hidden = true;
}

function repetirPedido(id) {
  const pedido = pedidos.find(p => p.id === id);
  if (!pedido) return;

  pedido.items.forEach(i => {
    const tope = stockDe(i.id);
    const existente = carrito.find(c => c.id === i.id);
    if (existente) {
      existente.cantidad = Math.min(existente.cantidad + i.cantidad, tope);
    } else {
      carrito.push({ id: i.id, precio: i.precio, titulo: i.titulo, imagen: i.imagen, cantidad: Math.min(i.cantidad, tope) });
    }
  });
  actualizarCarrito();
  cerrarPedidos();
  abrirCarrito();
  mostrarToast("Productos agregados a tu carrito.");
}


function mostrarUsuario() {
  const usuario = obtenerUsuario();
  if (!usuario) return;

  const nombreCompleto = usuario.firstName + " " + usuario.lastName;

  document.getElementById("nombreUsuario").textContent = usuario.firstName;
  document.getElementById("saludoHero").textContent = "Hola, " + usuario.firstName + " — tu súper en línea";
  document.getElementById("perfilSaludo").textContent = "Bienvenido, " + nombreCompleto;
  document.getElementById("perfilNombre").textContent = usuario.firstName;
  document.getElementById("perfilApellido").textContent = usuario.lastName;
  document.getElementById("perfilUsername").textContent = usuario.username;
  document.getElementById("perfilCorreo").textContent = usuario.email;

  aplicarFoto();
}

function aplicarFoto() {
  const usuario = obtenerUsuario();
  if (!usuario) return;

  const propia = leerDatos("foto", null);
  const origen = propia || "assets/Karin.jpeg";

  document.getElementById("fotoUsuario").src = origen;
  document.getElementById("perfilFoto").src = origen;
  document.getElementById("btnQuitarFoto").hidden = !propia;
}

function redimensionarImagen(archivo, lado) {
  return new Promise(function (resolve, reject) {
    const url = URL.createObjectURL(archivo);
    const img = new Image();

    img.onload = function () {
      // recorte cuadrado centrado
      const minimo = Math.min(img.width, img.height);
      const sx = (img.width - minimo) / 2;
      const sy = (img.height - minimo) / 2;

      const canvas = document.createElement("canvas");
      canvas.width = lado;
      canvas.height = lado;
      canvas.getContext("2d").drawImage(img, sx, sy, minimo, minimo, 0, 0, lado, lado);

      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la imagen"));
    };
    img.src = url;
  });
}

async function cambiarFoto(evento) {
  const archivo = evento.target.files[0];
  evento.target.value = ""; // permite elegir de nuevo el mismo archivo
  if (!archivo) return;

  if (!/^image\/(png|jpeg|webp)$/.test(archivo.type)) {
    mostrarToast("Elige una imagen PNG, JPG o WEBP.", "error");
    return;
  }
  if (archivo.size > 5 * 1024 * 1024) {
    mostrarToast("La imagen supera los 5 MB.", "error");
    return;
  }

  try {
    const imagen = await redimensionarImagen(archivo, 256);
    if (!guardarDatos("foto", imagen)) throw new Error("Sin espacio");
    aplicarFoto();
    mostrarToast("Foto de perfil actualizada.");
  } catch (error) {
    console.error(error);
    mostrarToast("No se pudo guardar la foto. Intenta con otra imagen.", "error");
  }
}

function quitarFoto() {
  localStorage.removeItem(claveUsuario("foto"));
  aplicarFoto();
  mostrarToast("Se restauró tu foto original.");
}

function togglePerfil() {
  const panel = document.getElementById("perfil-panel");
  const abrir = panel.hidden;
  panel.hidden = !abrir;
  document.getElementById("user-btn").setAttribute("aria-expanded", String(abrir));
}

function cerrarPerfil() {
  const panel = document.getElementById("perfil-panel");
  if (!panel || panel.hidden) return;
  panel.hidden = true;
  document.getElementById("user-btn").setAttribute("aria-expanded", "false");
}

document.addEventListener("click", function (e) {
  if (!e.target.closest("#user-menu")) cerrarPerfil();
});

document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") {
    cerrarPerfil();
    cerrarCarrito();
    cerrarPedidos();
  }
});

async function verificarSesion() {
  const token = localStorage.getItem("token");
  if (!token) {
    cerrarSesion();
    return;
  }

  try {
    const respuesta = await fetch(API_ME, {
      method: "GET",
      headers: { "Authorization": "Bearer " + token }
    });

    if (respuesta.status === 401 || respuesta.status === 403) {
      cerrarSesion(true);
      return;
    }
    if (!respuesta.ok) {
      throw new Error("No se pudo verificar la sesión (" + respuesta.status + ")");
    }

    const usuario = await respuesta.json();
    console.log("Usuario autenticado:", usuario);
  } catch (error) {
    // Un fallo de red no cierra la sesión: solo se avisa en consola
    console.warn(error);
  }
}

window.onload = function () {
  verificarSesion();
  mostrarUsuario();
  cargarCarritoGuardado();
  listarProductos();

  document.getElementById("buscar").addEventListener("keydown", function (e) {
    if (e.key === "Enter") buscarProductos();
  });
};
