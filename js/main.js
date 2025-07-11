// js/main.js

import { supabase, showMessage } from './auth.js';
// Importa las funciones directamente desde modal-cart.js
import { addProductToCart, updateCartCountDisplay } from './modal-cart.js'; 

let allProducts = []; // Almacena todos los productos cargados

document.addEventListener('DOMContentLoaded', async () => {
    const productsContainer = document.getElementById('products-container');
    const loadingProductsMessage = document.getElementById('loading-products-message');
    const noProductsMessage = document.getElementById('no-products-message');
    // cartCount ya no se manipula directamente desde aquí, sino desde updateCartCountDisplay en modal-cart.js
    // const cartCount = document.getElementById('cart-count'); 

    // Ya no necesitamos 'shoppingCart' en localStorage en main.js, modal-cart.js lo maneja con la DB.
    // let shoppingCart = JSON.parse(localStorage.getItem('shoppingCart')) || []; 

    // --- Cargar y Mostrar Productos ---
    async function fetchProducts() {
        loadingProductsMessage.style.display = 'block';
        noProductsMessage.style.display = 'none';
        productsContainer.innerHTML = ''; 

        try {
            const { data: products, error } = await supabase
                .from('products')
                .select('*');

            if (error) {
                console.error('Error al cargar productos:', error);
                showMessage('Error al cargar productos. Intenta de nuevo más tarde.', 'error');
                loadingProductsMessage.style.display = 'none';
                return;
            }

            allProducts = products; // Almacenar productos cargados

            loadingProductsMessage.style.display = 'none';

            if (products.length === 0) {
                noProductsMessage.style.display = 'block';
            } else {
                products.forEach(product => {
                    const productCard = document.createElement('div');
                    productCard.classList.add('product-card');
                    productCard.innerHTML = `
                        <img src="${product.image_url || 'https://via.placeholder.com/200'}" alt="${product.name}">
                        <div class="product-info">
                            <h3>${product.name}</h3>
                            <p>${product.description || 'Sin descripción.'}</p>
                            <p class="product-price">$${product.price.toFixed(2)}</p>
                            <p>Stock: ${product.stock}</p>
                            <button class="add-to-cart-btn" data-id="${product.id}" ${product.stock === 0 ? 'disabled' : ''}>
                                ${product.stock === 0 ? 'Sin Stock' : 'Añadir al Carrito'}
                            </button>
                            <a href="product-detail.html?id=${product.id}" class="btn-view-details">Ver Detalles</a>
                        </div>
                    `;
                    productsContainer.appendChild(productCard);
                });

                // Modificar el listener del botón "Añadir al Carrito" para usar la función importada
                document.querySelectorAll('.add-to-cart-btn').forEach(button => {
                    button.addEventListener('click', async (e) => {
                        const productId = e.target.dataset.id;
                        const productToAdd = allProducts.find(p => p.id === productId); 
                        if (productToAdd && productToAdd.stock > 0) {
                            // Llama a la función addProductToCart importada
                            const added = await addProductToCart(productId, 1); // Añadir 1 unidad
                            if (added) {
                                // addProductToCart ya muestra el mensaje.
                                // updateCartCountDisplay() ya se llama dentro de addProductToCart y al cargar la página
                            }
                        } else {
                            showMessage('Este producto no está disponible o no hay stock.', 'error');
                        }
                    });
                });
            }
        } catch (err) {
            console.error('Error inesperado al cargar productos:', err);
            showMessage('Ocurrió un error inesperado al cargar los productos.', 'error');
            loadingProductsMessage.style.display = 'none';
        }
    }

    // --- Inicialización ---
    // Escuchar cambios de autenticación para actualizar el carrito en el header
    supabase.auth.onAuthStateChange((event, session) => {
        updateCartCountDisplay(); // Usamos la función de modal-cart.js
    });

    // Llamada inicial para actualizar el conteo del carrito y cargar los productos
    await updateCartCountDisplay(); // Actualiza el contador del carrito al cargar la página
    await fetchProducts(); // Cargar los productos al inicio
});


// Exportamos getProductById, aunque product-detail.js ya no lo usa directamente para la carga principal.
// Se mantiene por si otros módulos lo necesitan.
export const getProductById = (id) => {
    return allProducts.find(product => product.id == id);
};