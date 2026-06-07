// ==========================================
// CONFIGURACIÓN BACKEND (INFINITYFREE)
// ==========================================
const API_URL = 'http://mymarket-api.gamer.gd/api.php';

// 1. Estado Centralizado de la Aplicación
const AppState = {
    products: [],
    filteredProducts: [],
    savedProducts: JSON.parse(localStorage.getItem('mymarket_products')) || [],
    cart: JSON.parse(localStorage.getItem('mymarket_cart')) || [],
    loading: true,
    userLoggedIn: false,
    user: {
        name: '',
        email: '',
        password: '',
        purchases: [],
        sales: []
    },
    registeredUsers: JSON.parse(localStorage.getItem('mymarket_users')) || [],
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

// 3. Petición API Real conectada a phpMyAdmin con Control de Errores
async function loadCatalogData() {
    renderSkeletons();
    try {
        // Hacemos la petición real a tu archivo api.php en InfinityFree
        const response = await fetch(`${API_URL}?action=get_products`);
        
        if (!response.ok) {
            throw new Error(`Error en la red: ${response.status}`);
        }

        // Convertimos la respuesta de la base de datos a JSON
        const data = await response.json();

        const fetchedProducts = Array.isArray(data) ? data : [];
        AppState.loading = false;

        if (fetchedProducts.length > 0) {
            AppState.products = [...fetchedProducts];
            AppState.filteredProducts = [...fetchedProducts];
            AppState.savedProducts = [...fetchedProducts];
            saveProducts();
            renderCatalog();
        } else if (AppState.savedProducts.length > 0) {
            AppState.products = [...AppState.savedProducts];
            AppState.filteredProducts = [...AppState.savedProducts];
            renderCatalog();
            showNotification("Mostrando productos publicados anteriormente.", "success");
        } else {
            AppState.products = [];
            AppState.filteredProducts = [];
            renderCatalog();
        }

    } catch (error) {
        console.error("Error al conectar con la base de datos:", error);
        AppState.loading = false;

        if (AppState.savedProducts.length > 0) {
            AppState.products = [...AppState.savedProducts];
            AppState.filteredProducts = [...AppState.savedProducts];
            renderCatalog();
            showNotification("Mostrando productos publicados anteriormente.", "success");
        } else {
            DOM.productsContainer.innerHTML = `<p class="error-msg">Ocurrió un error al cargar el catálogo desde el servidor. Por favor reintenta.</p>`;
            showNotification("Error de conexión con el servidor", "error");
        }
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
                <div class="product-actions">
                    <button class="btn-secondary" onclick="openProductDetails(${product.id})">Ver detalles</button>
                    <button class="btn-primary" ${isOut ? 'disabled' : ''} onclick="handleAddToCart(${product.id})">
                        ${isOut ? 'Sin existencias' : 'Añadir al carrito'}
                    </button>
                </div>
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
    persistCurrentUserAccount();
    renderCart();
    renderCatalog(); // Se renderiza de nuevo para actualizar los textos de stock en vivo
}

function saveRegisteredUsers() {
    localStorage.setItem('mymarket_users', JSON.stringify(AppState.registeredUsers));
}

function saveProducts() {
    localStorage.setItem('mymarket_products', JSON.stringify(AppState.savedProducts));
}

async function publishProductToServer(productData) {
    try {
        const response = await fetch(`${API_URL}?action=publish_product`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(productData)
        });

        if (!response.ok) {
            throw new Error(`Error en la red: ${response.status}`);
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error publicando producto en el servidor:', error);
        return { success: false, error };
    }
}

function getRegisteredUser(email) {
    return AppState.registeredUsers.find(user => user.email.toLowerCase() === email.toLowerCase());
}

function persistCurrentUserAccount() {
    if (!AppState.user.email) return;
    const existing = getRegisteredUser(AppState.user.email);
    const userCopy = {
        name: AppState.user.name,
        email: AppState.user.email,
        password: AppState.user.password,
        purchases: AppState.user.purchases,
        sales: AppState.user.sales
    };
    if (existing) {
        const index = AppState.registeredUsers.findIndex(user => user.email.toLowerCase() === AppState.user.email.toLowerCase());
        AppState.registeredUsers[index] = userCopy;
    } else {
        AppState.registeredUsers.push(userCopy);
    }
    saveRegisteredUsers();
}

function logoutUser() {
    AppState.userLoggedIn = false;
    AppState.user = {
        name: '',
        email: '',
        password: '',
        purchases: [],
        sales: []
    };
    loginBtn.classList.remove('hidden');
    userProfile.classList.remove('active');
    userProfile.querySelector('.profile-name').textContent = 'Usuario';
    renderUserProfile();
    closeModal(profileModal);
    showNotification('Has cerrado sesión.', 'success');
}

function loginLocalUser(user) {
    AppState.userLoggedIn = true;
    AppState.user.name = user.name || user.email.split('@')[0];
    AppState.user.email = user.email;
    AppState.user.password = user.password;
    AppState.user.purchases = user.purchases || [];
    AppState.user.sales = user.sales || [];
    if (!getRegisteredUser(user.email)) {
        AppState.registeredUsers.push(user);
        saveRegisteredUsers();
    }

    loginBtn.classList.add('hidden');
    userProfile.querySelector('.profile-name').textContent = AppState.user.name;
    userProfile.classList.add('active');
    renderUserProfile();
    closeModal(loginModal);
}

function tryLocalLogin(email, password) {
    const storedUser = getRegisteredUser(email);
    if (!storedUser) return false;
    if (storedUser.password !== password) return false;

    loginLocalUser(storedUser);
    return true;
}

function formatCurrency(amount) {
    if (AppState.currency === 'USD') {
        const usdAmount = amount * 0.028;
        return `$${usdAmount.toFixed(2)} USD`;
    }
    return `C$${amount.toFixed(2)}`;
}

function readImageFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
        reader.readAsDataURL(file);
    });
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
                <p>Contacto: ${item.phone}</p>
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
const paymentError = document.getElementById('payment-error');
const cardNumberInput = document.getElementById('card-number');
const cardExpiryInput = document.getElementById('card-expiry');
const closeBtnModal = document.getElementById('close-payment');
const paySubmitBtn = document.getElementById('pay-button');

const productDetailModal = document.getElementById('product-detail-modal');
const closeProductDetailBtn = document.getElementById('close-product-detail');
const detailProductImage = document.getElementById('detail-product-image');
const detailProductTitle = document.getElementById('detail-product-title');
const detailProductDescription = document.getElementById('detail-product-description');
const detailProductPrice = document.getElementById('detail-product-price');
const detailProductStock = document.getElementById('detail-product-stock');
const detailProductCategory = document.getElementById('detail-product-category');
const detailProductCondition = document.getElementById('detail-product-condition');
const detailSellerContact = document.getElementById('detail-seller-contact');
const detailContactWhatsapp = document.getElementById('detail-contact-whatsapp');
const detailContactError = document.getElementById('detail-contact-error');
let currentDetailProductId = null;

const loginBtn = document.getElementById('login-btn');
const loginModal = document.getElementById('login-modal');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const loginCloseBtn = document.getElementById('close-login');
const loginEmail = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');
const showRegisterBtn = document.getElementById('show-register-btn');
const registerForm = document.getElementById('register-form');
const registerError = document.getElementById('register-error');
const registerEmail = document.getElementById('register-email');
const registerPassword = document.getElementById('register-password');
const registerConfirmPassword = document.getElementById('register-confirm-password');
const showLoginBtn = document.getElementById('show-login-btn');
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
const logoutBtn = document.getElementById('logout-btn');
const logoutConfirm = document.getElementById('logout-confirm');
const confirmLogoutBtn = document.getElementById('confirm-logout-btn');
const cancelLogoutBtn = document.getElementById('cancel-logout-btn');

const openModal = (modal) => {
    modal.classList.add('active');
    if (modal === loginModal) {
        clearLoginError();
        clearRegisterError();
        showLoginForm();
    }
    if (modal === paymentModal) clearPaymentError();
};
const closeModal = (modal) => modal.classList.remove('active');

function showRegistrationForm() {
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
    clearLoginError();
    clearRegisterError();
}

function showLoginForm() {
    registerForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
    clearRegisterError();
    clearLoginError();
}

function showRegisterError(message) {
    registerError.textContent = message;
    registerError.classList.remove('hidden');
}

function clearRegisterError() {
    registerError.textContent = '';
    registerError.classList.add('hidden');
}

function openProductDetails(productId) {
    const product = AppState.products.find(p => p.id === productId);
    if (!product) return;

    detailProductImage.src = product.img;
    detailProductImage.alt = product.title;
    detailProductTitle.textContent = product.title;
    detailProductDescription.textContent = product.description || 'Descripción no disponible.';
    detailProductPrice.textContent = formatCurrency(product.price);
    detailProductStock.textContent = product.stock > 0 ? product.stock : 'Agotado';
    detailProductCategory.textContent = product.category || 'No especificado';
    detailProductCondition.textContent = product.condition || 'No especificado';

    const userHasPurchasedProduct = AppState.user.purchases.some(item => item.id === productId);
    const userHasAddedProductToCart = AppState.cart.some(item => item.id === productId);
    const canContactSeller = userHasPurchasedProduct || userHasAddedProductToCart;

    if (product.phone) {
        const cleanPhone = product.phone.replace(/\D/g, '');
        detailContactWhatsapp.dataset.phone = cleanPhone;
        detailContactWhatsapp.dataset.active = canContactSeller ? 'true' : 'false';
        detailContactWhatsapp.classList.toggle('inactive', !canContactSeller);
        detailContactWhatsapp.setAttribute('aria-label', canContactSeller ? 'Contactar por WhatsApp' : 'Contactar por WhatsApp (deshabilitado)');
        detailSellerContact.classList.remove('hidden');
    } else {
        detailSellerContact.classList.add('hidden');
    }
    clearDetailContactError();
    openModal(productDetailModal);
}

detailContactWhatsapp.addEventListener('click', () => {
    const phone = detailContactWhatsapp.dataset.phone;
    const isActive = detailContactWhatsapp.dataset.active === 'true';
    if (!phone) return;
    if (!isActive) {
        showDetailContactError('Solo puedes contactar al vendedor si agregas el producto al carrito o ya lo compraste.');
        return;
    }
    clearDetailContactError();
    const product = AppState.products.find(item => item.phone && item.phone.replace(/\D/g, '') === phone);
    const productName = product ? product.title : 'Estoy interesado';
    const message = `Hola, estoy interesado en el producto: ${productName}. ¿Podría obtener más información?`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
});

function showDetailContactError(message) {
    detailContactError.textContent = message;
    detailContactError.classList.remove('hidden');
}

function clearDetailContactError() {
    detailContactError.textContent = '';
    detailContactError.classList.add('hidden');
}

loginBtn.addEventListener('click', () => openModal(loginModal));
loginCloseBtn.addEventListener('click', () => closeModal(loginModal));
loginModal.addEventListener('click', (e) => { if (e.target === loginModal) closeModal(loginModal); });
showRegisterBtn.addEventListener('click', showRegistrationForm);
showLoginBtn.addEventListener('click', showLoginForm);

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearRegisterError();

    const email = registerEmail.value.trim();
    const password = registerPassword.value.trim();
    const confirmPassword = registerConfirmPassword.value.trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showRegisterError('Correo electrónico inválido.');
        return;
    }
    if (password.length < 6) {
        showRegisterError('La contraseña debe tener al menos 6 caracteres.');
        return;
    }
    if (password !== confirmPassword) {
        showRegisterError('Las contraseñas no coinciden.');
        return;
    }
    if (getRegisteredUser(email)) {
        showRegisterError('Ya existe una cuenta con ese correo. Inicia sesión.');
        return;
    }

    const userName = email.split('@')[0].replace(/\./g, ' ') || 'Usuario';
    AppState.userLoggedIn = true;
    AppState.user.name = userName;
    AppState.user.email = email;
    AppState.user.password = password;
    AppState.user.purchases = [];
    AppState.user.sales = [];
    const newUser = {
        name: userName,
        email,
        password,
        purchases: [],
        sales: []
    };
    AppState.registeredUsers.push(newUser);
    persistCurrentUserAccount();
    loginBtn.classList.add('hidden');
    userProfile.querySelector('.profile-name').textContent = userName;
    userProfile.classList.add('active');
    renderUserProfile();
    closeModal(loginModal);
    showNotification('Cuenta creada y sesión iniciada.', 'success');
    registerForm.reset();
    showLoginForm();
});

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
logoutBtn.addEventListener('click', () => {
    if (!logoutConfirm) return;
    logoutConfirm.classList.remove('hidden');
    logoutBtn.classList.add('hidden');
});
confirmLogoutBtn.addEventListener('click', () => {
    logoutUser();
    if (!logoutConfirm) return;
    logoutConfirm.classList.add('hidden');
});
cancelLogoutBtn.addEventListener('click', () => {
    if (!logoutConfirm) return;
    logoutConfirm.classList.add('hidden');
    logoutBtn.classList.remove('hidden');
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearLoginError();

    const email = loginEmail.value.trim();
    const password = loginPassword.value.trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showLoginError('Correo electrónico inválido.');
        return;
    }
    if (password.length < 6) {
        showLoginError('La contraseña debe tener al menos 6 caracteres.');
        return;
    }

    if (tryLocalLogin(email, password)) {
        showNotification('¡Bienvenido de vuelta a MyMarket!', 'success');
        loginForm.reset();
        return;
    }

    try {
        const response = await fetch(`${API_URL}?action=login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
            throw new Error(`Error en la red: ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
            showNotification('¡Bienvenido de vuelta a MyMarket!', 'success');
            loginLocalUser({
                name: result.user.nombre || result.user.name || email.split('@')[0],
                email: result.user.email,
                password,
                purchases: result.user.purchases || [],
                sales: result.user.sales || []
            });
            loginForm.reset();
        } else {
            showLoginError(result.message || 'Credenciales incorrectas.');
        }
    } catch (error) {
        if (tryLocalLogin(email, password)) {
            showNotification('¡Bienvenido de vuelta a MyMarket! Login local exitoso.', 'success');
            loginForm.reset();
            return;
        }
        showLoginError('Error al procesar la solicitud de ingreso.');
        console.error(error);
    }
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
    const phone = document.getElementById('sell-phone').value.trim();
    const delivery = document.getElementById('sell-delivery').value;
    const imageFiles = document.getElementById('sell-images').files;

    if (!title || !category || !price || !quantity || !condition || !description || !location || !phone || !delivery) {
        showNotification('Por favor completa todos los campos del formulario de venta.', 'error');
        return;
    }

    if (!/^[0-9+\s()-]{7,20}$/.test(phone)) {
        showNotification('Por favor ingresa un teléfono de contacto válido.', 'error');
        return;
    }

    btn.disabled = true;
    btnText.textContent = 'Publicando...';
    spinner.classList.remove('hidden');

    await new Promise(resolve => setTimeout(resolve, 1200));

    let productImage = `https://images.unsplash.com/photo-1606813900440-1144e9f6b78a?w=300`;
    if (imageFiles.length > 0) {
        try {
            productImage = await readImageFileAsDataURL(imageFiles[0]);
        } catch (error) {
            showNotification('No se pudo cargar la imagen, se usará una imagen por defecto.', 'warning');
        }
    }

    const productPayload = {
        title,
        description,
        price: Number(price),
        stock: Number(quantity),
        img: productImage,
        category,
        condition,
        phone,
        delivery,
        location,
        seller: AppState.user.email || 'anonimo'
    };

    const result = await publishProductToServer(productPayload);
    let publishedProduct = null;

    if (result.success && result.product) {
        publishedProduct = {
            id: Number(result.product.id),
            title,
            price: Number(price),
            stock: Number(quantity),
            img: productImage,
            category,
            condition,
            description,
            phone,
            rating: 0,
            votes: 0
        };
    } else {
        showNotification('No se pudo guardar el producto en el servidor. Se guarda localmente para mostrarlo temporalmente.', 'warning');
        const newId = Math.max(0, ...AppState.products.map(p => p.id)) + 1;
        publishedProduct = {
            id: newId,
            title,
            price: Number(price),
            stock: Number(quantity),
            img: productImage,
            category,
            condition,
            description,
            phone,
            rating: 0,
            votes: 0
        };
    }

    AppState.products.unshift(publishedProduct);
    AppState.savedProducts.unshift(publishedProduct);
    saveProducts();

    const saleRecord = {
        id: publishedProduct.id,
        title,
        price: Number(price),
        quantity: Number(quantity),
        condition,
        location,
        phone,
        delivery,
        date: new Date().toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
    };
    AppState.user.sales.unshift(saleRecord);

    const currentSearch = DOM.searchInput.value.trim().toLowerCase();
    if (!currentSearch || title.toLowerCase().includes(currentSearch)) {
        AppState.filteredProducts.unshift(publishedProduct);
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
    clearPaymentError();
    const totalValue = AppState.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    document.getElementById('modal-total').textContent = formatCurrency(totalValue);
    openModal(paymentModal);
});

// Cerrar modal
closeBtnModal.addEventListener('click', () => closeModal(paymentModal));
paymentModal.addEventListener('click', (e) => { if (e.target === paymentModal) closeModal(paymentModal); });

closeProductDetailBtn.addEventListener('click', () => closeModal(productDetailModal));
productDetailModal.addEventListener('click', (e) => { if (e.target === productDetailModal) closeModal(productDetailModal); });

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

function showPaymentError(message) {
    paymentError.textContent = message;
    paymentError.classList.remove('hidden');
}

function clearPaymentError() {
    paymentError.textContent = '';
    paymentError.classList.add('hidden');
}

function showLoginError(message) {
    loginError.textContent = message;
    loginError.classList.remove('hidden');
}

function clearLoginError() {
    loginError.textContent = '';
    loginError.classList.add('hidden');
}

loginEmail.addEventListener('input', clearLoginError);
loginPassword.addEventListener('input', clearLoginError);

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

    clearPaymentError();
    const validation = validatePaymentDetails();
    if (!validation.valid) {
        showPaymentError(validation.message);
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