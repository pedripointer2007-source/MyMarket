// 1. Estado Centralizado de la Aplicación
const AppState = {
    products: [],
    filteredProducts: [],
    cart: JSON.parse(localStorage.getItem('mymarket_cart')) || [],
    loading: true,
    userLoggedIn: false,
    user: {
        name: '',
        email: '',
        purchases: [],
        sales: []
    },
    currency: 'NIO'
};

// 2. Elementos del DOM Cacheables
const DOM = {
    productsContainer: document.getElementById('products-container'),
    cartSidebar: document.getElementById('cart-sidebar'),
    cartBtn: document.getElementById('cart-btn'),
    closeCartBtn: document.getElementById('close-cart'),
    cartItemsContainer: document.getElementById('cart-items-container'),
    cartCount: document.getElementById('cart-count'),
    cartTotal: document.getElementById('cart-total-val'),
    searchInput: document.getElementById('search-input'),
    searchBtn: document.getElementById('search-btn'),
    checkoutBtn: document.getElementById('checkout-btn')
};

// 3. Simulación de Petición API con Control de Errores Explicito
async function loadCatalogData() {
    renderSkeletons();
    try {
        // Simulamos latencia de red (1.2 segundos)
        await new Promise(resolve => setTimeout(resolve, 1200));

        // Base de Datos Mock con Stock controlado
        AppState.products = [
            { id: 101, title: "Auriculares Inalámbricos Premium Pro Max", price: 129.99, stock: 4, img: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200", rating: 4.8, votes: 38 },
            { id: 102, title: "Smartwatch Deportivo Waterproof GPS", price: 89.50, stock: 7, img: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200", rating: 4.4, votes: 24 },
            { id: 103, title: "Teclado Mecánico RGB Switch Blue Latino", price: 64.00, stock: 2, img: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=200", rating: 4.7, votes: 17 },
            { id: 104, title: "Cámara DSLR Semi-Profesional 24MP", price: 549.99, stock: 0, img: "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=200", rating: 4.2, votes: 12 }
        ];

        AppState.filteredProducts = [...AppState.products];
        AppState.loading = false;
        renderCatalog();

    } catch (error) {
        AppState.loading = false;
        DOM.productsContainer.innerHTML = `<p class="error-msg">Ocurrió un error al cargar el catálogo. Por favor reintenta.</p>`;
        showNotification("Error de conexión con el servidor", "error");
    }
}

// 4. Renderizadores de UI
function renderSkeletons() {
    DOM.productsContainer.innerHTML = Array(4).fill(`
        <div class="skeleton-card">
            <div class="skeleton-anim" style="height: 160px; margin-bottom: 15px;"></div>
            <div class="skeleton-anim" style="height: 20px; width: 80%; margin-bottom: 10px;"></div>
            <div class="skeleton-anim" style="height: 15px; width: 40%; margin-bottom: 20px;"></div>
            <div class="skeleton-anim" style="height: 35px; border-radius:20px;"></div>
        </div>
    `).join('');
}

function renderCatalog() {
    if (AppState.filteredProducts.length === 0) {
        DOM.productsContainer.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 40px; color: var(--text-muted);">No se encontraron productos que coincidan con tu búsqueda.</div>`;
        return;
    }

    DOM.productsContainer.innerHTML = AppState.filteredProducts.map(product => {
        // Calcular stock real restando lo que ya está en el carrito temporal
        const cartItem = AppState.cart.find(item => item.id === product.id);
        const dynamicStock = cartItem ? product.stock - cartItem.quantity : product.stock;
        const isOut = dynamicStock <= 0;

        return `
            <article class="product-card">
                <div class="product-image-wrapper">
                    <img src="${product.img}" alt="${product.title}" loading="lazy">
                </div>
                <div class="product-info">
                    <h3 class="product-title" title="${product.title}">${product.title}</h3>
                    <div class="product-meta">
                        <p class="product-price">${formatCurrency(product.price)}</p>
                        <p class="product-stock">${isOut ? '<span style="color:red; font-weight:600;">Agotado</span>' : `Disponibles: ${dynamicStock}`}</p>
                        ${renderRatingStars(product)}
                    </div>
                </div>
                <button class="btn-primary" ${isOut ? 'disabled' : ''} onclick="handleAddToCart(${product.id})">
                    ${isOut ? 'Sin existencias' : 'Añadir al carrito'}
                </button>
            </article>
        `;
    }).join('');
}

function renderCart() {
    DOM.cartItemsContainer.innerHTML = '';
    
    if (AppState.cart.length === 0) {
        DOM.cartItemsContainer.innerHTML = `<p style="text-align:center; color: var(--text-muted); margin-top:30px;">Tu carrito está vacío.</p>`;
        DOM.cartCount.textContent = '0';
        DOM.cartTotal.textContent = '0.00';
        return;
    }

    let totalCount = 0;
    let totalPrice = 0;

    AppState.cart.forEach(item => {
        totalCount += item.quantity;
        totalPrice += item.price * item.quantity;

        const div = document.createElement('div');
        div.classList.add('cart-item');
        div.innerHTML = `
            <div class="cart-item-details">
                <h4 class="cart-item-title">${item.title}</h4>
                <p class="cart-item-price">${formatCurrency(item.price)} x ${item.quantity}</p>
            </div>
            <button class="remove-item-btn" onclick="handleRemoveFromCart(${item.id})" aria-label="Eliminar item">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        `;
        DOM.cartItemsContainer.appendChild(div);
    });

    DOM.cartCount.textContent = totalCount;
    DOM.cartTotal.textContent = formatCurrency(totalPrice);
}

// 5. Controladores de Eventos y Acciones (Lógica de negocio)
function handleAddToCart(id) {
    if (!AppState.userLoggedIn) {
        showNotification('Debes iniciar sesión antes de añadir productos al carrito.', 'error');
        openModal(loginModal);
        return;
    }

    const product = AppState.products.find(p => p.id === id);
    const cartItem = AppState.cart.find(item => item.id === id);
    const currentQtyInCart = cartItem ? cartItem.quantity : 0;

    // Validación estricta de límites de stock
    if (currentQtyInCart >= product.stock) {
        showNotification("Límite de unidades disponibles alcanzado", "error");
        return;
    }

    if (cartItem) {
        cartItem.quantity++;
    } else {
        AppState.cart.push({ ...product, quantity: 1 });
    }

    syncAndSaveData();
    showNotification(`Se añadió "${product.title}" al carrito.`);
}

function handleRemoveFromCart(id) {
    AppState.cart = AppState.cart.filter(item => item.id !== id);
    syncAndSaveData();
    showNotification("Producto removido del carrito", "success");
}

function handleRateProduct(id, value) {
    if (!AppState.userLoggedIn) {
        showNotification('Debes iniciar sesión para valorar productos.', 'error');
        openModal(loginModal);
        return;
    }

    const product = AppState.products.find(p => p.id === id);
    if (!product) return;

    const previousTotal = (product.rating || 0) * (product.votes || 0);
    product.votes = (product.votes || 0) + 1;
    product.rating = (previousTotal + value) / product.votes;
    showNotification(`Gracias por valorar ${value} estrellas.`, 'success');
    renderCatalog();
}

function renderRatingStars(product) {
    const fullStars = Math.floor(product.rating || 0);
    const hasHalf = product.rating && (product.rating - fullStars >= 0.5);
    const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);
    let stars = '';

    for (let i = 1; i <= fullStars; i++) {
        stars += `<i class="fa-solid fa-star" onclick="handleRateProduct(${product.id}, ${i})" title="Valorar ${i} estrellas"></i>`;
    }
    if (hasHalf) {
        stars += `<i class="fa-solid fa-star-half-stroke" onclick="handleRateProduct(${product.id}, ${fullStars + 1})" title="Valorar ${fullStars + 1} estrellas"></i>`;
    }
    for (let i = 1; i <= emptyStars; i++) {
        const index = fullStars + (hasHalf ? 1 : 0) + i;
        stars += `<i class="fa-regular fa-star" onclick="handleRateProduct(${product.id}, ${index})" title="Valorar ${index} estrellas"></i>`;
    }

    const ratingText = product.votes ? `${product.rating.toFixed(1)} (${product.votes})` : 'Sin valoraciones';
    return `<div class="rating-stars">${stars}<span class="rating-text">${ratingText}</span></div>`;
}

function syncAndSaveData() {
    localStorage.setItem('mymarket_cart', JSON.stringify(AppState.cart));
    renderCart();
    renderCatalog(); // Se renderiza de nuevo para actualizar los textos de stock en vivo
}

function formatCurrency(amount) {
    if (AppState.currency === 'USD') {
        const usdAmount = amount * 0.028;
        return `$${usdAmount.toFixed(2)} USD`;
    }
    return `C$${amount.toFixed(2)}`;
}

function renderUserProfile() {
    profileModalName.textContent = AppState.user.name || 'Usuario';
    profileModalEmail.textContent = AppState.user.email || 'Sin correo';
    profilePurchasesCount.textContent = AppState.user.purchases.length;
    profileSalesCount.textContent = AppState.user.sales.length;

    const formatCurrency = (amount) => {
        if (AppState.currency === 'USD') {
            const usdAmount = amount * 0.028;
            return `$${usdAmount.toFixed(2)} USD`;
        }
        return `C$${amount.toFixed(2)}`;
    };

    if (AppState.user.purchases.length === 0) {
        purchaseHistoryContainer.innerHTML = '<div class="history-empty">No has realizado compras aún.</div>';
    } else {
        purchaseHistoryContainer.innerHTML = AppState.user.purchases.map(item => `
            <div class="history-item">
                <h5>${item.title}</h5>
                <p>Cantidad: ${item.quantity} · Total: ${formatCurrency(item.price * item.quantity)}</p>
                <p>${item.date}</p>
            </div>
        `).join('');
    }

    if (AppState.user.sales.length === 0) {
        salesHistoryContainer.innerHTML = '<div class="history-empty">No has publicado ventas aún.</div>';
    } else {
        salesHistoryContainer.innerHTML = AppState.user.sales.map(item => `
            <div class="history-item">
                <h5>${item.title}</h5>
                <p>Cantidad: ${item.quantity} · Precio: ${formatCurrency(item.price)}</p>
                <p>${item.condition} · ${item.location}</p>
                <p>${item.delivery} · ${item.date}</p>
            </div>
        `).join('');
    }
}

// Mecánica del Buscador
function performSearch() {
    const query = DOM.searchInput.value.toLowerCase().trim();
    AppState.filteredProducts = AppState.products.filter(p => 
        p.title.toLowerCase().includes(query)
    );
    renderCatalog();
}

// 6. Sistema de Feedback visual (Notificaciones Toast)
function showNotification(message, type = "success") {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === "success" ? "fa-circle-check" : "fa-circle-exclamation";
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
    
    container.appendChild(toast);

    // Animación de salida controlada por tiempos
    setTimeout(() => {
        toast.style.transition = "opacity 0.4s, transform 0.4s";
        toast.style.opacity = "0";
        toast.style.transform = "translateY(-10px)";
        setTimeout(() => toast.remove(), 400);
    }, 2800);
}

// 7. Event Listeners del Sistema
DOM.cartBtn.addEventListener('click', () => DOM.cartSidebar.classList.add('active'));
DOM.closeCartBtn.addEventListener('click', () => DOM.cartSidebar.classList.remove('active'));
DOM.searchInput.addEventListener('input', performSearch); // Búsqueda reactiva mientras se escribe
DOM.searchBtn.addEventListener('click', performSearch);

// Inicialización Automática
document.addEventListener('DOMContentLoaded', () => {
    loadCatalogData();
    renderCart();
});

// Nuevos elementos del DOM para el pago
const paymentModal = document.getElementById('payment-modal');
const paymentForm = document.getElementById('payment-form');
const cardNumberInput = document.getElementById('card-number');
const cardExpiryInput = document.getElementById('card-expiry');
const closeBtnModal = document.getElementById('close-payment');
const paySubmitBtn = document.getElementById('pay-button');

const loginBtn = document.getElementById('login-btn');
const loginModal = document.getElementById('login-modal');
const loginForm = document.getElementById('login-form');
const loginCloseBtn = document.getElementById('close-login');
const loginEmail = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');
const buyBtn = document.getElementById('buy-btn');
const sellBtn = document.getElementById('sell-btn');
const userProfile = document.getElementById('user-profile');
const profileModal = document.getElementById('profile-modal');
const closeProfileBtn = document.getElementById('close-profile');
const profileModalName = document.getElementById('profile-modal-name');
const profileModalEmail = document.getElementById('profile-modal-email');
const profilePurchasesCount = document.getElementById('profile-purchases-count');
const profileSalesCount = document.getElementById('profile-sales-count');
const profileCurrencySelect = document.getElementById('profile-currency-select');
const purchaseHistoryContainer = document.getElementById('purchase-history');
const salesHistoryContainer = document.getElementById('sales-history');
const sellModal = document.getElementById('sell-modal');
const sellForm = document.getElementById('sell-form');
const sellCloseBtn = document.getElementById('close-sell');

const openModal = (modal) => modal.classList.add('active');
const closeModal = (modal) => modal.classList.remove('active');

loginBtn.addEventListener('click', () => openModal(loginModal));
loginCloseBtn.addEventListener('click', () => closeModal(loginModal));
loginModal.addEventListener('click', (e) => { if (e.target === loginModal) closeModal(loginModal); });

buyBtn.addEventListener('click', () => {
    if (!AppState.userLoggedIn) {
        showNotification('Debes iniciar sesión para comprar.', 'error');
        openModal(loginModal);
    }
});

sellBtn.addEventListener('click', () => {
    if (!AppState.userLoggedIn) {
        showNotification('Debes iniciar sesión para vender.', 'error');
        openModal(loginModal);
        return;
    }
    openModal(sellModal);
});

userProfile.addEventListener('click', () => {
    if (!AppState.userLoggedIn) {
        showNotification('Debes iniciar sesión para ver tu perfil.', 'error');
        openModal(loginModal);
        return;
    }
    renderUserProfile();
    openModal(profileModal);
});

closeProfileBtn.addEventListener('click', () => closeModal(profileModal));
profileModal.addEventListener('click', (e) => { if (e.target === profileModal) closeModal(profileModal); });

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = loginForm.querySelector('button[type="submit"]');
    const btnText = btn.querySelector('.btn-text');
    const spinner = btn.querySelector('.spinner');
    const defaultText = btnText.textContent;

    const email = loginEmail.value.trim();
    const password = loginPassword.value.trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showNotification('Inicio de sesión fallido: correo inválido.', 'error');
        return;
    }

    if (password.length < 6) {
        showNotification('Inicio de sesión fallido: la contraseña debe tener al menos 6 caracteres.', 'error');
        return;
    }

    btn.disabled = true;
    btnText.textContent = 'Verificando...';
    spinner.classList.remove('hidden');

    await new Promise(resolve => setTimeout(resolve, 1000));
    const userName = email.split('@')[0].replace(/\./g, ' ') || 'Usuario';
    AppState.userLoggedIn = true;
    AppState.user.name = userName;
    AppState.user.email = email;
    loginBtn.classList.add('hidden');
    userProfile.querySelector('.profile-name').textContent = userName;
    userProfile.classList.add('active');
    closeModal(loginModal);
    renderUserProfile();
    showNotification('Inicio de sesión exitoso.', 'success');
    loginForm.reset();

    btn.disabled = false;
    btnText.textContent = defaultText;
    spinner.classList.add('hidden');
});

sellCloseBtn.addEventListener('click', () => closeModal(sellModal));
sellModal.addEventListener('click', (e) => { if (e.target === sellModal) closeModal(sellModal); });

profileCurrencySelect.addEventListener('change', (e) => {
    AppState.currency = e.target.value;
    renderUserProfile();
    renderCatalog();
    renderCart();
});

sellForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = sellForm.querySelector('button[type="submit"]');
    const btnText = btn.querySelector('.btn-text');
    const spinner = btn.querySelector('.spinner');
    const defaultText = btnText.textContent;

    const title = document.getElementById('sell-title').value.trim();
    const category = document.getElementById('sell-category').value;
    const price = document.getElementById('sell-price').value.trim();
    const quantity = document.getElementById('sell-quantity').value.trim();
    const condition = document.getElementById('sell-condition').value;
    const description = document.getElementById('sell-description').value.trim();
    const location = document.getElementById('sell-location').value.trim();
    const delivery = document.getElementById('sell-delivery').value;

    if (!title || !category || !price || !quantity || !condition || !description || !location || !delivery) {
        showNotification('Por favor completa todos los campos del formulario de venta.', 'error');
        return;
    }

    btn.disabled = true;
    btnText.textContent = 'Publicando...';
    spinner.classList.remove('hidden');

    await new Promise(resolve => setTimeout(resolve, 1200));

    const newId = Math.max(0, ...AppState.products.map(p => p.id)) + 1;
    const newProduct = {
        id: newId,
        title,
        price: Number(price),
        stock: Number(quantity),
        img: `https://images.unsplash.com/photo-1606813900440-1144e9f6b78a?w=300`,
        category,
        condition,
        description,
        rating: 0,
        votes: 0
    };

    AppState.products.unshift(newProduct);

    const saleRecord = {
        id: newId,
        title,
        price: Number(price),
        quantity: Number(quantity),
        condition,
        location,
        delivery,
        date: new Date().toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
    };
    AppState.user.sales.unshift(saleRecord);

    const currentSearch = DOM.searchInput.value.trim().toLowerCase();
    if (!currentSearch || title.toLowerCase().includes(currentSearch)) {
        AppState.filteredProducts.unshift(newProduct);
    }

    showNotification('Producto publicado correctamente en Marketplace.', 'success');
    closeModal(sellModal);
    sellForm.reset();
    renderCatalog();
    renderUserProfile();

    btn.disabled = false;
    btnText.textContent = defaultText;
    spinner.classList.add('hidden');
});

// Abrir el modal desde el carrito
DOM.checkoutBtn.addEventListener('click', () => {
    if (!AppState.userLoggedIn) {
        showNotification('Debes iniciar sesión antes de proceder al pago.', 'error');
        openModal(loginModal);
        return;
    }
    if (AppState.cart.length === 0) {
        showNotification("El carrito está vacío", "error");
        return;
    }
    const totalValue = AppState.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    document.getElementById('modal-total').textContent = formatCurrency(totalValue);
    openModal(paymentModal);
});

// Cerrar modal
closeBtnModal.addEventListener('click', () => closeModal(paymentModal));
paymentModal.addEventListener('click', (e) => { if (e.target === paymentModal) closeModal(paymentModal); });

// Formateo automático de tarjeta (Ej: 0000 0000 0000 0000)
cardNumberInput.addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, '');
    value = value.replace(/(\d{4})(?=\d)/g, '$1 ');
    e.target.value = value;
});

// Formateo de expiración (MM/YY)
cardExpiryInput.addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length >= 2) value = value.slice(0, 2) + '/' + value.slice(2);
    e.target.value = value;
});

function validatePaymentDetails() {
    const name = document.getElementById('card-name').value.trim();
    const cardNumber = cardNumberInput.value.replace(/\s/g, '');
    const expiry = document.getElementById('card-expiry').value.trim();
    const cvv = document.getElementById('card-cvv').value.trim();

    if (!name) return { valid: false, message: 'Nombre en la tarjeta requerido.' };
    if (!/^\d{16}$/.test(cardNumber)) return { valid: false, message: 'Número de tarjeta inválido.' };
    if (!/^\d{2}\/\d{2}$/.test(expiry)) return { valid: false, message: 'Fecha de expiración inválida.' };

    const [monthStr, yearStr] = expiry.split('/');
    const month = Number(monthStr);
    const year = Number('20' + yearStr);
    const today = new Date();
    const expiryDate = new Date(year, month - 1, 1);
    if (month < 1 || month > 12) return { valid: false, message: 'Mes de expiración inválido.' };
    if (expiryDate < new Date(today.getFullYear(), today.getMonth(), 1)) return { valid: false, message: 'La tarjeta está vencida.' };
    if (!/^\d{3}$/.test(cvv)) return { valid: false, message: 'CVV inválido.' };

    return { valid: true };
}

// Proceso de validación de pago
paymentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const btn = paySubmitBtn;
    const btnText = btn.querySelector('.btn-text');
    const spinner = btn.querySelector('.spinner');
    const defaultText = btnText.textContent;

    const validation = validatePaymentDetails();
    if (!validation.valid) {
        showNotification(`Compra fallida: ${validation.message}`, 'error');
        return;
    }

    btn.disabled = true;
    btnText.textContent = 'Procesando...';
    spinner.classList.remove('hidden');

    try {
        await new Promise((resolve, reject) => {
            setTimeout(() => {
                Math.random() > 0.1 ? resolve() : reject();
            }, 2000);
        });

        const purchaseDate = new Date().toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
        AppState.cart.forEach(item => {
            AppState.user.purchases.unshift({
                id: item.id,
                title: item.title,
                price: item.price,
                quantity: item.quantity,
                date: purchaseDate
            });
        });

        showNotification('Compra exitosa. Gracias por tu compra.', 'success');
        AppState.cart = []; // Vaciar carrito
        syncAndSaveData();
        renderUserProfile();
        closeModal(paymentModal);
        paymentForm.reset();
    } catch (error) {
        showNotification('Compra fallida: la transacción no fue aprobada.', 'error');
    } finally {
        btn.disabled = false;
        btnText.textContent = defaultText;
        spinner.classList.add('hidden');
    }
});