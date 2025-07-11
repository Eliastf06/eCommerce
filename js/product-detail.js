// js/product-detail.js

import { supabase, showMessage, updateAuthUI } from './auth.js';
import { addProductToCart, updateCartCountDisplay } from './modal-cart.js';


document.addEventListener('DOMContentLoaded', async () => {
    const productDetailContainer = document.getElementById('product-detail-container');
    const loadingMessage = document.getElementById('loading-message');
    const errorMessage = document.getElementById('error-message');

    // Función para obtener el ID del producto de la URL
    const getProductIdFromUrl = () => {
        const params = new URLSearchParams(window.location.search);
        const productId = params.get('id');
        console.log('ID del producto obtenido de la URL:', productId); // <-- Añadido para depurar
        return productId;
    };

    // Función asíncrona para buscar y renderizar los detalles del producto
    const fetchAndRenderProductDetail = async (productId) => {
        loadingMessage.style.display = 'block';
        errorMessage.style.display = 'none';
        productDetailContainer.innerHTML = '';

        if (!productId) {
            loadingMessage.style.display = 'none';
            errorMessage.style.display = 'block';
            errorMessage.textContent = 'ID de producto no proporcionado en la URL.';
            console.error('Error: ID de producto no proporcionado.'); // <-- Añadido para depurar
            return;
        }

        try {
            console.log('Intentando cargar producto con ID:', productId); // <-- Añadido para depurar
            const { data: product, error } = await supabase
                .from('products')
                .select('*')
                .eq('id', productId)
                .single();

            if (error) {
                console.error('Error al cargar detalles del producto desde Supabase:', error); // <-- Añadido para depurar
                loadingMessage.style.display = 'none';
                errorMessage.style.display = 'block';
                if (error.code === 'PGRST116') {
                    errorMessage.textContent = 'Producto no encontrado. El ID proporcionado no existe.';
                } else {
                    errorMessage.textContent = 'Error al cargar los detalles del producto. Intenta de nuevo más tarde.';
                }
                return;
            }

            loadingMessage.style.display = 'none';
            if (!product) {
                errorMessage.style.display = 'block';
                errorMessage.textContent = 'Producto no encontrado.';
                console.warn('Producto no encontrado después de la consulta, data es null/undefined.'); // <-- Añadido para depurar
                return;
            }

            console.log('Producto cargado con éxito:', product); // <-- Añadido para depurar

            productDetailContainer.innerHTML = `
                <div class="product-detail-image-container">
                    <img src="${product.image_url || 'https://via.placeholder.com/400x300'}" alt="${product.name}" class="product-detail-image">
                </div>
                <div class="product-detail-info">
                    <h1>${product.name}</h1>
                    <p class="product-detail-price">$${product.price.toFixed(2)}</p>
                    <p class="product-detail-description">${product.description || 'Sin descripción detallada.'}</p>
                    <p class="product-detail-stock ${product.stock < 5 ? 'low-stock' : ''}">
                        Stock disponible: ${product.stock} unidades
                    </p>
                    <button class="product-detail-add-to-cart" data-product-id="${product.id}" ${product.stock === 0 ? 'disabled' : ''}>
                        <i class="fas fa-shopping-cart"></i> ${product.stock === 0 ? 'Sin Stock' : 'Agregar al Carrito'}
                    </button>
                    <a href="index.html" class="btn-back-to-products">
                        <i class="fas fa-arrow-left"></i> Volver a Productos
                    </a>
                </div>
            `;

            const addToCartButton = productDetailContainer.querySelector('.product-detail-add-to-cart');
            if (addToCartButton) {
                addToCartButton.addEventListener('click', async () => {
                    await addProductToCart(product.id, 1);
                });
            }

        } catch (err) {
            console.error('Error inesperado en fetchAndRenderProductDetail:', err); // <-- Añadido para depurar
            loadingMessage.style.display = 'none';
            errorMessage.style.display = 'block';
            errorMessage.textContent = 'Ocurrió un error inesperado al cargar los detalles. Por favor, intenta de nuevo.';
        }
    };

    const productId = getProductIdFromUrl();
    await fetchAndRenderProductDetail(productId);
    
    updateAuthUI();
    await updateCartCountDisplay();
});