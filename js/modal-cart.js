// js/modal-cart.js

// Importa el cliente Supabase y la función showMessage desde auth.js
// Es crucial que 'auth.js' exporte 'supabase' y 'showMessage'.
import { supabase, showMessage } from './auth.js';

// --- Funciones de Utilidad ---

// Función para obtener el usuario actual (usada internamente por modal-cart.js)
async function getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
        console.error('Error al obtener usuario en modal-cart.js:', error);
        return null;
    }
    return user;
}

// Referencias del DOM para el carrito y el modal de pago
// ¡Importante! Estos IDs deben existir en tu HTML (index.html, product-detail.html)
const cartModal = document.getElementById('cart-modal');
const closeModalBtn = document.getElementById('close-cart-modal-btn'); // ID cambiado para evitar conflictos
const cartItemsContainer = document.getElementById('cart-items-container');
const cartTotalElement = document.getElementById('cart-total-display'); // ID cambiado para evitar conflictos
const checkoutBtn = document.getElementById('modal-checkout-btn'); // ID cambiado para evitar conflictos
const paymentModal = document.getElementById('payment-modal');
const closePaymentModalBtn = document.getElementById('close-payment-modal-btn');
const paymentForm = document.getElementById('payment-form');
const cartIcon = document.getElementById('cart-icon'); // El icono del carrito en el header
const modalMessage = document.getElementById('modal-message'); // Para mensajes dentro del modal

// Función para mostrar mensajes dentro del modal del carrito
function showCartModalMessage(message, type = 'success') {
    if (modalMessage) {
        modalMessage.textContent = message;
        // Limpiar clases anteriores y añadir la nueva
        modalMessage.classList.remove('success', 'error', 'info', 'black');
        modalMessage.classList.add(type);
        modalMessage.style.display = 'block';
        setTimeout(() => {
            modalMessage.style.display = 'none';
            modalMessage.textContent = ''; // Limpiar el mensaje
            modalMessage.classList.remove(type); // Quitar la clase del tipo
        }, 5000);
    } else {
        // Fallback a la función showMessage principal si el modal-message no existe
        console.warn('Elemento de mensaje del modal no encontrado. Usando showMessage global.');
        showMessage(message, type);
    }
}

/**
 * Función para añadir un producto al carrito del usuario.
 * Se exporta para ser utilizada desde main.js o product-detail.js.
 * @param {string} productId - El ID del producto a añadir.
 * @param {number} quantity - La cantidad a añadir (por defecto 1).
 * @returns {boolean} - true si se añadió/actualizó con éxito, false en caso de error.
 */
export async function addProductToCart(productId, quantity = 1) {
    if (!productId) {
        showMessage('Error: ID de producto no encontrado.', 'error');
        return false;
    }

    const user = await getCurrentUser();
    if (!user) {
        showMessage('Debes iniciar sesión para añadir productos al carrito.', 'error');
        return false;
    }

    try {
        // 1. Verificar el stock del producto
        const { data: productData, error: productError } = await supabase
            .from('products')
            .select('name, stock')
            .eq('id', productId)
            .single();

        if (productError) {
            throw new Error('Error al obtener stock del producto: ' + productError.message);
        }
        if (!productData) {
            showMessage('Producto no encontrado.', 'error');
            return false;
        }

        const currentProductStock = productData.stock;
        const productName = productData.name; // Obtener el nombre del producto

        // 2. Verificar si el producto ya está en el carrito del usuario
        const { data: existingItem, error: fetchError } = await supabase
            .from('cart_items')
            .select('id, quantity')
            .eq('user_id', user.id)
            .eq('product_id', productId)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows found (no hay filas para single())
            throw new Error('Error al verificar ítem en carrito: ' + fetchError.message);
        }

        let newQuantityInCart = quantity; // Cantidad a añadir si es un nuevo ítem
        let cartItemIdToUpdate = null;
        let messageOutput = ''; // Variable para el mensaje de éxito

        if (existingItem) {
            // Si el producto ya está, actualiza la cantidad
            newQuantityInCart = existingItem.quantity + quantity;
            cartItemIdToUpdate = existingItem.id;
        }

        if (newQuantityInCart > currentProductStock) {
            showMessage(`No hay suficiente stock de "${productName}" para añadir más. Stock disponible: ${currentProductStock}.`, 'error');
            return false;
        }

        if (cartItemIdToUpdate) {
            // Actualizar el ítem existente
            const { error: updateError } = await supabase
                .from('cart_items')
                .update({ quantity: newQuantityInCart })
                .eq('id', cartItemIdToUpdate);

            if (updateError) {
                throw new Error('Error al actualizar cantidad en carrito: ' + updateError.message);
            }
            messageOutput = `Cantidad de "${productName}" actualizada en el carrito a ${newQuantityInCart}.`;
        } else {
            // Insertar un nuevo ítem en el carrito
            const { error: insertError } = await supabase
                .from('cart_items')
                .insert({
                    user_id: user.id,
                    product_id: productId,
                    quantity: quantity
                });

            if (insertError) {
                throw new Error('Error al añadir producto al carrito: ' + insertError.message);
            }
            messageOutput = `Artículo "${productName}" añadido correctamente al carrito.`; // Mensaje solicitado
        }

        // Mostrar el mensaje de éxito aquí
        showMessage(messageOutput, 'success');

        await updateCartCountDisplay(); // Actualizar el contador del carrito en el header
        return true; // Éxito

    } catch (err) {
        console.error('Error en addProductToCart:', err.message);
        showMessage('No se pudo añadir el producto al carrito. ' + err.message, 'error');
        return false;
    }
}

/**
 * Muestra los ítems del carrito en el modal.
 * Se exporta para poder abrir el modal y mostrar el carrito desde otras partes si es necesario.
 */
export async function displayCartItems() {
    if (!cartItemsContainer || !cartTotalElement) {
        console.warn("Elementos del DOM del carrito no encontrados. Asegúrate de que el HTML del modal esté cargado.");
        return;
    }

    cartItemsContainer.innerHTML = '<p>Cargando carrito...</p>';
    cartTotalElement.textContent = '0.00';

    try {
        const user = await getCurrentUser();
        if (!user) {
            cartItemsContainer.innerHTML = '<p>Debes <a href="login.html">iniciar sesión</a> para ver tu carrito.</p>';
            return;
        }

        // Obtener los ítems del carrito del usuario, uniendo con la tabla de productos
        const { data: cartData, error } = await supabase
            .from('cart_items')
            .select(`
                id,
                quantity,
                product_id,
                products (
                    id,
                    name,
                    price,
                    stock,
                    image_url
                )
            `)
            .eq('user_id', user.id);

        if (error) {
            console.error('Error al cargar ítems del carrito:', error);
            showCartModalMessage('Error al cargar tu carrito. Intenta de nuevo.', 'error');
            return;
        }

        // Mapear los datos para facilitar el acceso
        const currentCartItems = cartData.map(item => ({
            cartItemId: item.id, // ID del registro en cart_items
            productId: item.product_id,
            quantity: item.quantity,
            name: item.products.name,
            price: item.products.price,
            stock: item.products.stock, // Stock actual del producto
            imageUrl: item.products.image_url
        }));

        if (currentCartItems.length === 0) {
            cartItemsContainer.innerHTML = '<p>Tu carrito está vacío.</p>';
            cartTotalElement.textContent = '0.00';
            return;
        }

        cartItemsContainer.innerHTML = ''; // Limpiar para añadir los nuevos items
        let total = 0;

        currentCartItems.forEach(item => {
            const itemTotal = item.price * item.quantity;
            total += itemTotal;

            const cartItemDiv = document.createElement('div');
            cartItemDiv.classList.add('cart-item');
            cartItemDiv.innerHTML = `
                <img src="${item.imageUrl || 'https://via.placeholder.com/80'}" alt="${item.name}" class="cart-item-img">
                <div class="cart-item-details">
                    <h4>${item.name}</h4>
                    <p>Precio Unitario: $${item.price.toFixed(2)}</p>
                    <div class="quantity-controls">
                        <button class="decrease-quantity-btn" data-cart-item-id="${item.cartItemId}" data-product-id="${item.productId}">-</button>
                        <span>${item.quantity}</span>
                        <button class="increase-quantity-btn" data-cart-item-id="${item.cartItemId}" data-product-id="${item.productId}">+</button>
                    </div>
                    <p>Subtotal: $${itemTotal.toFixed(2)}</p>
                </div>
                <button class="remove-item-btn" data-cart-item-id="${item.cartItemId}" data-product-id="${item.productId}">X</button>
            `;
            cartItemsContainer.appendChild(cartItemDiv);
        });

        cartTotalElement.textContent = total.toFixed(2);

    } catch (err) {
        console.error('Error al mostrar el carrito:', err);
        showCartModalMessage('Error al cargar el carrito.', 'error');
    }
}

/**
 * Actualiza la cantidad de un ítem en el carrito o lo elimina.
 * @param {string} cartItemId - El ID del registro en 'cart_items'.
 * @param {string} productId - El ID del producto.
 * @param {number} change - La cantidad a cambiar (+1, -1, o -Infinity para eliminar).
 */
async function updateCartItemQuantity(cartItemId, productId, change) {
    try {
        const user = await getCurrentUser();
        if (!user) return;

        // Obtener el ítem actual del carrito y el stock del producto
        const { data: item, error: itemError } = await supabase
            .from('cart_items')
            .select('quantity, products(stock, name)')
            .eq('id', cartItemId)
            .single();

        if (itemError) {
            throw new Error('Error al obtener ítem del carrito: ' + itemError.message);
        }
        if (!item || !item.products) {
            showCartModalMessage('Producto no encontrado en el carrito.', 'error');
            return;
        }

        const productStock = item.products.stock;
        const productName = item.products.name;
        let newQuantity = item.quantity + change;

        if (change === -Infinity || newQuantity <= 0) {
            // Eliminar el ítem
            if (!confirm(`¿Estás seguro de que quieres eliminar "${productName}" de tu carrito?`)) {
                return;
            }
            const { error: deleteError } = await supabase
                .from('cart_items')
                .delete()
                .eq('id', cartItemId);

            if (deleteError) {
                throw new Error('Error al eliminar ítem del carrito: ' + deleteError.message);
            }
            showCartModalMessage(`"${productName}" eliminado del carrito.`, 'info');
        } else {
            // Actualizar cantidad
            if (newQuantity > productStock) {
                showCartModalMessage(`No hay suficiente stock de "${productName}". Stock disponible: ${productStock}.`, 'error');
                return;
            }
            const { error: updateError } = await supabase
                .from('cart_items')
                .update({ quantity: newQuantity })
                .eq('id', cartItemId);

            if (updateError) {
                throw new Error('Error al actualizar cantidad: ' + updateError.message);
            }
            showCartModalMessage(`Cantidad de "${productName}" actualizada a ${newQuantity}.`, 'success');
        }

        await updateCartCountDisplay(); // Actualizar el contador del ícono del carrito
        await displayCartItems(); // Re-renderizar el modal del carrito

    } catch (err) {
        console.error('Error al actualizar cantidad del carrito:', err);
        showCartModalMessage('Error al actualizar la cantidad del producto.', 'error');
    }
}

/**
 * Procesa el pago y finaliza la compra.
 */
async function processPayment() {
    showCartModalMessage('Procesando pago...', 'info');
    if (paymentForm) { // Asegurarse de que el formulario exista antes de intentar deshabilitar
        const submitButton = paymentForm.querySelector('button[type="submit"]');
        if (submitButton) submitButton.disabled = true; // Deshabilitar botón de pago
    }


    const user = await getCurrentUser();
    if (!user) {
        showCartModalMessage('Debes iniciar sesión para completar la compra.', 'error');
        if (paymentForm) {
            const submitButton = paymentForm.querySelector('button[type="submit"]');
            if (submitButton) submitButton.disabled = false;
        }
        return;
    }

    // Simulación de validación de tarjeta (muy básica)
    const cardNumberInput = document.getElementById('card-number');
    const expiryDateInput = document.getElementById('expiry-date');
    const cvvInput = document.getElementById('cvv');
    const cardNameInput = document.getElementById('card-name');

    const cardNumber = cardNumberInput ? cardNumberInput.value : '';
    const expiryDate = expiryDateInput ? expiryDateInput.value : '';
    const cvv = cvvInput ? cvvInput.value : '';
    const cardName = cardNameInput ? cardNameInput.value.trim() : '';

    if (cardNumber.length !== 16 || !/^\d+$/.test(cardNumber) ||
        expiryDate.length !== 5 || !/^\d{2}\/\d{2}$/.test(expiryDate) ||
        (cvv.length !== 3 && cvv.length !== 4) || !/^\d+$/.test(cvv) ||
        cardName === '') {
        showCartModalMessage('Por favor, ingresa datos de tarjeta válidos.', 'error');
        if (paymentForm) {
            const submitButton = paymentForm.querySelector('button[type="submit"]');
            if (submitButton) submitButton.disabled = false;
        }
        return;
    }

    // Simulación de 2 segundos de procesamiento
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
        const totalAmount = parseFloat(cartTotalElement.textContent);
        if (isNaN(totalAmount) || totalAmount <= 0) {
            showCartModalMessage('El total del carrito es $0.00 o inválido. Añade productos antes de pagar.', 'error');
            if (paymentForm) {
                const submitButton = paymentForm.querySelector('button[type="submit"]');
                if (submitButton) submitButton.disabled = false;
            }
            return;
        }

        // 1. Crear una nueva Orden en la tabla 'orders'
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert({
                user_id: user.id,
                total_amount: totalAmount,
                status: 'completed', // O 'pending' si hay un Gateway de pago real
                payment_method: 'credit_card'
            })
            .select()
            .single(); // Para obtener el ID de la orden insertada

        if (orderError) {
            throw new Error('Error al crear la orden: ' + orderError.message);
        }

        const orderId = order.id;

        // 2. Añadir Detalles de la Orden y Actualizar Stock de Productos
        // Primero, obtén los ítems del carrito actual para la compra
        const { data: cartItemsForOrder, error: fetchCartError } = await supabase
            .from('cart_items')
            .select('product_id, quantity, products(price, stock)') // Obtener precio y stock actual para validación final
            .eq('user_id', user.id);

        if (fetchCartError) {
            throw new Error('Error al obtener ítems del carrito para la orden: ' + fetchCartError.message);
        }
        if (!cartItemsForOrder || cartItemsForOrder.length === 0) {
            throw new Error('El carrito está vacío, no se puede procesar la orden.');
        }

        // Mapea los ítems del carrito para insertar en 'order_details' y actualizar 'products'
        const orderDetailsAndStockUpdatePromises = cartItemsForOrder.map(async (item) => {
            const productId = item.product_id;
            const quantityPurchased = item.quantity;
            const priceAtPurchase = item.products.price;
            const currentStock = item.products.stock;

            // Insertar detalle de la orden en 'order_details'
            const { error: detailError } = await supabase
                .from('order_details')
                .insert({
                    order_id: orderId,
                    product_id: productId,
                    quantity: quantityPurchased,
                    price_at_purchase: priceAtPurchase
                });
            if (detailError) {
                console.error(`Error al insertar detalle para producto ${productId}:`, detailError);
            }

            // Actualizar el stock del producto en 'products'
            const newStock = Math.max(0, currentStock - quantityPurchased); // Asegura que el stock no sea negativo
            const { error: stockError } = await supabase
                .from('products')
                .update({ stock: newStock })
                .eq('id', productId);
            if (stockError) {
                console.error(`Error al actualizar stock para producto ${productId}:`, stockError);
            }
        });

        await Promise.all(orderDetailsAndStockUpdatePromises); // Esperar a que todas las operaciones se completen

        // 3. Vaciar el Carrito del Usuario en la DB (tabla 'cart_items')
        const { error: clearCartError } = await supabase
            .from('cart_items')
            .delete()
            .eq('user_id', user.id);

        if (clearCartError) {
            console.error('Error al vaciar el carrito en DB:', clearCartError);
        }

        // --- Compra Exitosa ---
        showCartModalMessage('¡Compra realizada con éxito! Recibirás un correo de confirmación.', 'success');

        // Esperar un momento para que el usuario vea el mensaje y luego cerrar modales
        setTimeout(async () => {
            if (paymentModal) paymentModal.classList.remove('active');
            if (cartModal) cartModal.classList.remove('active');
            if (paymentForm) paymentForm.reset(); // Limpiar el formulario de pago
            await updateCartCountDisplay(); // Actualizar el contador a 0
            await displayCartItems(); // Re-renderizar el modal del carrito para mostrarlo vacío
        }, 3000);

    } catch (err) {
        console.error('Error durante el proceso de compra:', err.message);
        showCartModalMessage(`Error al completar la compra: ${err.message}`, 'error');
    } finally {
        if (paymentForm) {
            const submitButton = paymentForm.querySelector('button[type="submit"]');
            if (submitButton) submitButton.disabled = false; // Re-habilitar botón de pago
        }
    }
}

/**
 * Actualiza el número de ítems en el icono del carrito en el header.
 * Se exporta para poder actualizar el contador desde otras partes (e.g., al iniciar sesión).
 */
export async function updateCartCountDisplay() {
    const cartCountSpan = document.getElementById('cart-count');
    if (!cartCountSpan) return;

    const user = await getCurrentUser();
    if (!user) {
        cartCountSpan.textContent = '0';
        return;
    }

    const { data, error, count } = await supabase
        .from('cart_items')
        .select('id', { count: 'exact' }) // count: 'exact' para obtener el número de filas directamente
        .eq('user_id', user.id);

    if (error) {
        console.error('Error al obtener el conteo del carrito:', error);
        cartCountSpan.textContent = '0';
        return;
    }
    // 'count' es la forma más eficiente de obtener el número total de filas con Supabase
    cartCountSpan.textContent = count || 0;
}

// --- Event Listeners para el Modal del Carrito ---
document.addEventListener('DOMContentLoaded', () => {
    // Escuchar clics en el icono del carrito para abrir el modal
    if (cartIcon) {
        cartIcon.addEventListener('click', async (event) => {
            event.preventDefault(); // Evitar navegación si es un enlace
            if (cartModal) {
                cartModal.classList.add('active');
                await displayCartItems(); // Cargar los ítems al abrir el modal
            }
        });
    }

    // Escuchar clic en el botón de cerrar del modal del carrito
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            if (cartModal) cartModal.classList.remove('active');
        });
    }

    // Delegación de eventos para los botones de cantidad y eliminar dentro del carrito
    if (cartItemsContainer) {
        cartItemsContainer.addEventListener('click', async (event) => {
            const target = event.target;
            // Busca el atributo data-cart-item-id en el botón o en su ancestro más cercano
            const cartItemId = target.dataset.cartItemId || target.closest('button')?.dataset.cartItemId;
            const productId = target.dataset.productId || target.closest('button')?.dataset.productId;

            if (!cartItemId || !productId) return; // Asegúrate de tener ambos IDs

            if (target.classList.contains('decrease-quantity-btn')) {
                await updateCartItemQuantity(cartItemId, productId, -1);
            } else if (target.classList.contains('increase-quantity-btn')) {
                await updateCartItemQuantity(cartItemId, productId, 1);
            } else if (target.classList.contains('remove-item-btn')) {
                await updateCartItemQuantity(cartItemId, productId, -Infinity); // Usa -Infinity para indicar eliminación
            }
        });
    }

    // Escuchar clic en el botón "Proceder al Pago" del modal del carrito
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', async () => {
            const user = await getCurrentUser();
            if (!user) {
                showCartModalMessage('Debes iniciar sesión para proceder al pago.', 'error');
                return;
            }

            const total = parseFloat(cartTotalElement.textContent);
            if (isNaN(total) || total <= 0) {
                showCartModalMessage('Tu carrito está vacío o el total es inválido. Añade productos antes de pagar.', 'error');
                return;
            }

            if (cartModal) cartModal.classList.remove('active');
            if (paymentModal) paymentModal.classList.add('active');
        });
    }

    // Escuchar clic en el botón de cerrar del modal de pago
    if (closePaymentModalBtn) {
        closePaymentModalBtn.addEventListener('click', () => {
            if (paymentModal) paymentModal.classList.remove('active');
            if (cartModal) cartModal.classList.add('active'); // Volver al modal del carrito
        });
    }

    // Escuchar el envío del formulario de pago
    if (paymentForm) {
        paymentForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // Prevenir el envío tradicional del formulario
            await processPayment();
        });
    }

    // Llama a esta función al cargar la página para asegurar que el contador del carrito esté actualizado
    updateCartCountDisplay();
});