// js/cart.js

import { supabase, showMessage } from './auth.js';

document.addEventListener('DOMContentLoaded', async () => {
    const cartItemsList = document.getElementById('cart-items-list');
    const emptyCartMessage = document.getElementById('empty-cart-message');
    const cartSummary = document.getElementById('cart-summary');
    const cartTotal = document.getElementById('cart-total');
    const checkoutButton = document.getElementById('checkout-button');
    const paymentSection = document.getElementById('payment-section');
    const paymentForm = document.getElementById('payment-form');
    const finalTotalDisplay = document.getElementById('final-total');
    const cancelPaymentButton = document.getElementById('cancel-payment');
    const cartMessageDiv = document.getElementById('cart-message'); // Para mensajes del carrito

    let currentCartItems = []; // Almacenará los ítems del carrito con detalles completos

    // --- Funciones de Utilidad ---

    // Función para obtener el usuario actual
    async function getCurrentUser() {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) {
            console.error('Error al obtener usuario:', error);
            return null;
        }
        return user;
    }

    // Función para mostrar mensajes en la sección del carrito
    function displayCartMessage(message, type) {
        cartMessageDiv.textContent = message;
        cartMessageDiv.className = `cart-message ${type}`; // Clase para estilos (success, error, info)
        cartMessageDiv.style.display = 'block';
        setTimeout(() => {
            cartMessageDiv.style.display = 'none';
        }, 5000);
    }

    // --- Carga y Renderizado del Carrito ---

    async function fetchCartItems() {
        const user = await getCurrentUser();
        if (!user) {
            displayCartMessage('Debes iniciar sesión para ver tu carrito.', 'info');
            cartItemsList.innerHTML = '';
            emptyCartMessage.style.display = 'block';
            cartSummary.style.display = 'none';
            paymentSection.style.display = 'none';
            return;
        }

        try {
            // Obtenemos los ítems del carrito del usuario actual, uniendo con la tabla de productos
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
                displayCartMessage('Error al cargar tu carrito. Intenta de nuevo.', 'error');
                return;
            }

            currentCartItems = cartData.map(item => ({
                cartItemId: item.id, // ID del registro en cart_items
                productId: item.product_id,
                quantity: item.quantity,
                // Detalles del producto
                name: item.products.name,
                price: item.products.price,
                stock: item.products.stock, // Stock actual del producto
                imageUrl: item.products.image_url
            }));

            renderCart();

        } catch (err) {
            console.error('Error inesperado al obtener carrito:', err);
            displayCartMessage('Ocurrió un error inesperado al cargar el carrito.', 'error');
        }
    }

    function renderCart() {
        cartItemsList.innerHTML = ''; // Limpiar la lista antes de renderizar
        let total = 0;

        if (currentCartItems.length === 0) {
            emptyCartMessage.style.display = 'block';
            cartSummary.style.display = 'none';
            paymentSection.style.display = 'none';
            return;
        }

        emptyCartMessage.style.display = 'none'; // Ocultar mensaje de carrito vacío

        currentCartItems.forEach(item => {
            const itemTotal = item.price * item.quantity;
            total += itemTotal;

            const cartItemDiv = document.createElement('div');
            cartItemDiv.classList.add('cart-item');
            cartItemDiv.innerHTML = `
                <img src="${item.imageUrl || 'https://via.placeholder.com/80'}" alt="${item.name}" class="cart-item-image">
                <div class="cart-item-info">
                    <h4>${item.name}</h4>
                    <p>Precio Unitario: $${item.price.toFixed(2)}</p>
                    <div class="cart-item-quantity-controls">
                        <button class="decrease-quantity-btn" data-product-id="${item.productId}" data-cart-item-id="${item.cartItemId}">-</button>
                        <span>${item.quantity}</span>
                        <button class="increase-quantity-btn" data-product-id="${item.productId}" data-cart-item-id="${item.cartItemId}">+</button>
                    </div>
                </div>
                <p class="cart-item-price">$${itemTotal.toFixed(2)}</p>
                <button class="remove-item-btn" data-product-id="${item.productId}" data-cart-item-id="${item.cartItemId}"><i class="fas fa-trash-alt"></i></button>
            `;
            cartItemsList.appendChild(cartItemDiv);
        });

        cartTotal.textContent = `$${total.toFixed(2)}`;
        finalTotalDisplay.textContent = `$${total.toFixed(2)}`; // Actualiza el total en la sección de pago
        cartSummary.style.display = 'block';

        // Añadir event listeners a los botones de cantidad y eliminar
        document.querySelectorAll('.increase-quantity-btn').forEach(btn => {
            btn.addEventListener('click', updateQuantity);
        });
        document.querySelectorAll('.decrease-quantity-btn').forEach(btn => {
            btn.addEventListener('click', updateQuantity);
        });
        document.querySelectorAll('.remove-item-btn').forEach(btn => {
            btn.addEventListener('click', removeItem);
        });
    }

    // --- Funciones de Modificación del Carrito ---

    async function updateQuantity(event) {
        const cartItemId = event.target.dataset.cartItemId;
        const productId = event.target.dataset.productId;
        const action = event.target.textContent === '+' ? 'increase' : 'decrease';

        const itemIndex = currentCartItems.findIndex(item => item.cartItemId === cartItemId);
        if (itemIndex === -1) return; // Item no encontrado

        let newQuantity = currentCartItems[itemIndex].quantity;
        const productStock = currentCartItems[itemIndex].stock; // Stock actual del producto

        if (action === 'increase') {
            if (newQuantity >= productStock) {
                displayCartMessage(`No hay suficiente stock para añadir más de "${currentCartItems[itemIndex].name}". Stock disponible: ${productStock}`, 'error');
                return;
            }
            newQuantity++;
        } else { // decrease
            if (newQuantity <= 1) {
                // Si la cantidad es 1 y se quiere decrementar, mejor eliminar el producto
                removeItem(event);
                return;
            }
            newQuantity--;
        }

        try {
            const { data, error } = await supabase
                .from('cart_items')
                .update({ quantity: newQuantity })
                .eq('id', cartItemId);

            if (error) {
                console.error('Error al actualizar cantidad en DB:', error);
                displayCartMessage('Error al actualizar la cantidad.', 'error');
                return;
            }

            // Actualizar la UI y el array local
            currentCartItems[itemIndex].quantity = newQuantity;
            renderCart();
            displayCartMessage('Cantidad actualizada.', 'success');

        } catch (err) {
            console.error('Error inesperado al actualizar cantidad:', err);
            displayCartMessage('Ocurrió un error inesperado.', 'error');
        }
    }

    async function removeItem(event) {
        const cartItemId = event.target.dataset.cartItemId || event.target.closest('button').dataset.cartItemId;
        const productName = currentCartItems.find(item => item.cartItemId === cartItemId)?.name || 'Producto';

        if (!confirm(`¿Estás seguro de que quieres eliminar "${productName}" de tu carrito?`)) {
            return;
        }

        try {
            const { data, error } = await supabase
                .from('cart_items')
                .delete()
                .eq('id', cartItemId);

            if (error) {
                console.error('Error al eliminar ítem del carrito en DB:', error);
                displayCartMessage('Error al eliminar el producto del carrito.', 'error');
                return;
            }

            // Actualizar la UI y el array local
            currentCartItems = currentCartItems.filter(item => item.cartItemId !== cartItemId);
            renderCart();
            displayCartMessage(`${productName} eliminado del carrito.`, 'info');

        } catch (err) {
            console.error('Error inesperado al eliminar ítem:', err);
            displayCartMessage('Ocurrió un error inesperado.', 'error');
        }
    }

    // --- Proceso de Pago ---

    checkoutButton.addEventListener('click', () => {
        if (currentCartItems.length === 0) {
            displayCartMessage('Tu carrito está vacío. Añade productos antes de pagar.', 'info');
            return;
        }
        cartSummary.style.display = 'none';
        paymentSection.style.display = 'block';
        finalTotalDisplay.textContent = cartTotal.textContent; // Asegura que el total final sea el mismo
    });

    cancelPaymentButton.addEventListener('click', () => {
        paymentSection.style.display = 'none';
        cartSummary.style.display = 'block';
        displayCartMessage('Pago cancelado.', 'info');
    });

    paymentForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const user = await getCurrentUser();
        if (!user) {
            displayCartMessage('Debes iniciar sesión para completar la compra.', 'error');
            return;
        }

        displayCartMessage('Procesando pago...', 'info');
        paymentForm.querySelector('button[type="submit"]').disabled = true; // Deshabilitar botón de pago

        // Simulación de validación de tarjeta (muy básica)
        const cardNumber = document.getElementById('card-number').value;
        const expiryDate = document.getElementById('expiry-date').value;
        const cvv = document.getElementById('cvv').value;
        const cardName = document.getElementById('card-name').value;

        if (cardNumber.length !== 16 || !/^\d+$/.test(cardNumber) ||
            expiryDate.length !== 5 || !/^\d{2}\/\d{2}$/.test(expiryDate) ||
            (cvv.length !== 3 && cvv.length !== 4) || !/^\d+$/.test(cvv) ||
            cardName.trim() === '') {
            displayCartMessage('Por favor, ingresa datos de tarjeta válidos.', 'error');
            paymentForm.querySelector('button[type="submit"]').disabled = false;
            return;
        }

        // Simulación de 2 segundos de procesamiento
        await new Promise(resolve => setTimeout(resolve, 2000));

        try {
            // 1. Crear una nueva Orden
            const totalAmount = parseFloat(cartTotal.textContent.replace('$', ''));
            const { data: order, error: orderError } = await supabase
                .from('orders')
                .insert({
                    user_id: user.id,
                    total_amount: totalAmount,
                    status: 'completed',
                    payment_method: 'credit_card'
                })
                .select()
                .single();

            if (orderError) {
                throw new Error('Error al crear la orden: ' + orderError.message);
            }

            const orderId = order.id;

            // 2. Añadir Detalles de la Orden y Actualizar Stock de Productos
            const orderDetailsPromises = currentCartItems.map(async (item) => {
                // Insertar detalle de la orden
                const { error: detailError } = await supabase
                    .from('order_details')
                    .insert({
                        order_id: orderId,
                        product_id: item.productId,
                        quantity: item.quantity,
                        price_at_purchase: item.price
                    });
                if (detailError) {
                    console.error(`Error al insertar detalle para producto ${item.name}:`, detailError);
                    // No lanzamos error fatal aquí para no detener toda la compra si un detalle falla
                }

                // Actualizar el stock del producto
                const newStock = item.stock - item.quantity;
                const { error: stockError } = await supabase
                    .from('products')
                    .update({ stock: newStock })
                    .eq('id', item.productId);
                if (stockError) {
                    console.error(`Error al actualizar stock para producto ${item.name}:`, stockError);
                    // Esto es crítico, pero si el pago ya se hizo, se debe manejar como una inconsistencia
                    // en un sistema real, se usarían transacciones o colas de mensajes.
                }
            });

            await Promise.all(orderDetailsPromises); // Esperar a que todos los detalles/stocks se actualicen

            // 3. Vaciar el Carrito del Usuario en la DB
            const { error: clearCartError } = await supabase
                .from('cart_items')
                .delete()
                .eq('user_id', user.id);

            if (clearCartError) {
                console.error('Error al vaciar el carrito en DB:', clearCartError);
                // Si esto falla, el carrito del usuario no se vaciará en la DB, pero la orden se creó.
            }

            // --- Compra Exitosa ---
            displayCartMessage('¡Compra realizada con éxito! Recibirás un correo de confirmación.', 'success');
            paymentSection.style.display = 'none'; // Ocultar sección de pago
            
            currentCartItems = []; // Vaciar el carrito localmente
            renderCart(); // Re-renderizar para mostrar carrito vacío

            paymentForm.reset(); // Limpiar el formulario de pago

        } catch (err) {
            console.error('Error durante el proceso de compra:', err.message);
            displayCartMessage(`Error al completar la compra: ${err.message}`, 'error');
        } finally {
            paymentForm.querySelector('button[type="submit"]').disabled = false; // Re-habilitar botón de pago
        }
    });


    // --- Lógica para añadir un producto al carrito desde otras páginas (si es necesario) ---
    // Esta función la podrías usar desde main.js o product-detail.js
    // para añadir items al carrito del usuario en la base de datos.
    window.addProductToUserCart = async (productId, quantity = 1) => {
        const user = await getCurrentUser();
        if (!user) {
            showMessage('Debes iniciar sesión para añadir productos al carrito.', 'error');
            return false;
        }

        try {
            // Primero, verifica si el producto ya está en el carrito del usuario
            const { data: existingItem, error: fetchError } = await supabase
                .from('cart_items')
                .select('id, quantity')
                .eq('user_id', user.id)
                .eq('product_id', productId)
                .single();

            if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows found
                throw new Error('Error al verificar ítem en carrito: ' + fetchError.message);
            }

            if (existingItem) {
                // Si el producto ya está, actualiza la cantidad
                const { data: productData, error: productError } = await supabase
                    .from('products')
                    .select('stock')
                    .eq('id', productId)
                    .single();

                if (productError) {
                    throw new Error('Error al obtener stock del producto: ' + productError.message);
                }

                const currentStock = productData.stock;
                const newQuantity = existingItem.quantity + quantity;

                if (newQuantity > currentStock) {
                    showMessage(`No hay suficiente stock para añadir más de este producto. Stock disponible: ${currentStock}.`, 'error');
                    return false;
                }

                const { error: updateError } = await supabase
                    .from('cart_items')
                    .update({ quantity: newQuantity })
                    .eq('id', existingItem.id);

                if (updateError) {
                    throw new Error('Error al actualizar cantidad en carrito: ' + updateError.message);
                }
                showMessage('Cantidad del producto actualizada en el carrito.', 'success');
            } else {
                // Si el producto no está, insértalo como un nuevo ítem
                // Antes de insertar, verifica si hay stock
                const { data: productData, error: productError } = await supabase
                    .from('products')
                    .select('stock')
                    .eq('id', productId)
                    .single();

                if (productError) {
                    throw new Error('Error al obtener stock del producto: ' + productError.message);
                }

                const currentStock = productData.stock;
                if (quantity > currentStock) {
                    showMessage(`No hay suficiente stock de este producto. Stock disponible: ${currentStock}.`, 'error');
                    return false;
                }

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
                showMessage('Producto añadido al carrito.', 'success');
            }
            return true; // Éxito
        } catch (err) {
            console.error('Error en addProductToUserCart:', err.message);
            showMessage('No se pudo añadir el producto al carrito. ' + err.message, 'error');
            return false;
        }
    };

    // --- Inicialización ---
    // Llamar a fetchCartItems cuando la página cargue
    fetchCartItems();
});