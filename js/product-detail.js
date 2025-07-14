// js/product-detail.js

import { supabase, showMessage, updateAuthUI } from './auth.js';
import { addProductToCart, updateCartCountDisplay } from './modal-cart.js';


document.addEventListener('DOMContentLoaded', async () => {
    const productDetailContainer = document.getElementById('product-detail-container');
    const loadingMessage = document.getElementById('loading-message');
    const errorMessage = document.getElementById('error-message');
    const productFeaturesContainer = document.getElementById('product-features').querySelector('ul');
    const reviewsList = document.getElementById('reviews-list');
    const reviewForm = document.getElementById('review-form');
    const starRatingContainer = document.getElementById('review-rating');
    const selectedRatingInput = document.getElementById('selected-rating');


    // Función para obtener el ID del producto de la URL
    const getProductIdFromUrl = () => {
        const params = new URLSearchParams(window.location.search);
        const productId = params.get('id');
        console.log('ID del producto obtenido de la URL:', productId);
        return productId;
    };

    // Función para renderizar las estrellas de calificación
    const renderStars = (rating) => {
        let starsHtml = '';
        for (let i = 1; i <= 5; i++) {
            starsHtml += `<i class="${i <= rating ? 'fas' : 'far'} fa-star"></i>`;
        }
        return starsHtml;
    };

    // Función para manejar la selección de estrellas en el formulario de reseña
    if (starRatingContainer) {
        starRatingContainer.addEventListener('mouseover', (e) => {
            if (e.target.matches('.star-rating i')) {
                const value = parseInt(e.target.dataset.value);
                starRatingContainer.querySelectorAll('i').forEach(star => {
                    if (parseInt(star.dataset.value) <= value) {
                        star.classList.remove('far');
                        star.classList.add('fas', 'hovered'); // Add 'hovered' class
                    } else {
                        star.classList.remove('fas', 'hovered');
                        star.classList.add('far');
                    }
                });
            }
        });

        starRatingContainer.addEventListener('mouseout', () => {
            const currentRating = parseInt(selectedRatingInput.value);
            starRatingContainer.querySelectorAll('i').forEach(star => {
                if (parseInt(star.dataset.value) <= currentRating) {
                    star.classList.remove('far');
                    star.classList.add('fas');
                } else {
                    star.classList.remove('fas');
                    star.classList.add('far');
                }
                star.classList.remove('hovered'); // Remove 'hovered' class on mouseout
            });
        });

        starRatingContainer.addEventListener('click', (e) => {
            if (e.target.matches('.star-rating i')) {
                const value = parseInt(e.target.dataset.value);
                selectedRatingInput.value = value;
                starRatingContainer.querySelectorAll('i').forEach(star => {
                    if (parseInt(star.dataset.value) <= value) {
                        star.classList.remove('far');
                        star.classList.add('fas');
                    } else {
                        star.classList.remove('fas');
                        star.classList.add('far');
                    }
                    star.classList.remove('hovered'); // Remove 'hovered' class on click
                });
            }
        });
    }

    // Función asíncrona para buscar y renderizar los detalles del producto
    const fetchAndRenderProductDetail = async (productId) => {
        loadingMessage.style.display = 'block';
        errorMessage.style.display = 'none';
        productDetailContainer.innerHTML = '';
        productFeaturesContainer.innerHTML = ''; // Clear existing features
        reviewsList.innerHTML = ''; // Clear existing reviews

        if (!productId) {
            loadingMessage.style.display = 'none';
            errorMessage.style.display = 'block';
            errorMessage.textContent = 'ID de producto no proporcionado en la URL.';
            console.error('Error: ID de producto no proporcionado.');
            return;
        }

        try {
            console.log('Intentando obtener producto con ID:', productId);
            const { data: product, error: productError } = await supabase
                .from('products')
                .select('*')
                .eq('id', productId)
                .single();

            if (productError) {
                if (productError.code === 'PGRST116') { // No rows found
                    errorMessage.textContent = 'Producto no encontrado.';
                } else {
                    errorMessage.textContent = `Error al cargar el producto: ${productError.message}`;
                }
                loadingMessage.style.display = 'none';
                errorMessage.style.display = 'block';
                console.error('Error fetching product:', productError.message);
                return;
            }

            loadingMessage.style.display = 'none';

            // Renderizar detalles del producto
            productDetailContainer.innerHTML = `
                <div class="product-detail-image-container">
                    <img src="${product.image_url}" alt="${product.name}" class="product-detail-image">
                </div>
                <div class="product-detail-info">
                    <h1>${product.name}</h1>
                    <p class="product-detail-price">$${product.price.toFixed(2)}</p>
                    <p class="product-detail-description">${product.description}</p>
                    <p class="product-detail-stock ${product.stock < 5 && product.stock > 0 ? 'low-stock' : (product.stock === 0 ? 'low-stock' : '')}">
                        Stock disponible: ${product.stock} unidades
                    </p>
                    <div class="quantity-selector">
                        <button id="decrease-quantity">-</button>
                        <input type="number" id="product-quantity" value="1" min="1" max="${product.stock}">
                        <button id="increase-quantity">+</button>
                    </div>
                    <button class="product-detail-add-to-cart" data-product-id="${product.id}" ${product.stock === 0 ? 'disabled' : ''}>
                        <i class="fas fa-shopping-cart"></i> ${product.stock === 0 ? 'Sin Stock' : 'Agregar al Carrito'}
                    </button>
                    <a href="index.html" class="btn-back-to-products">
                        <i class="fas fa-arrow-left"></i> Volver a Productos
                    </a>
                </div>
            `;

            // Populate features (example data, could be from DB)
            const features = [
                "Material de alta calidad",
                "Diseño ergonómico",
                "Fácil de usar",
                "Garantía de 1 año",
                "Envío rápido disponible"
            ]; // Replace with actual product features from `product` object if available

            features.forEach(feature => {
                const li = document.createElement('li');
                li.innerHTML = `<i class="fas fa-check-circle"></i> ${feature}`;
                productFeaturesContainer.appendChild(li);
            });


            // Quantity selector logic
            const quantityInput = document.getElementById('product-quantity');
            const decreaseBtn = document.getElementById('decrease-quantity');
            const increaseBtn = document.getElementById('increase-quantity');

            if (quantityInput) {
                quantityInput.addEventListener('change', () => {
                    let value = parseInt(quantityInput.value);
                    if (isNaN(value) || value < 1) {
                        quantityInput.value = 1;
                    } else if (value > product.stock) {
                        quantityInput.value = product.stock;
                    }
                });
            }

            if (decreaseBtn) {
                decreaseBtn.addEventListener('click', () => {
                    let value = parseInt(quantityInput.value);
                    if (value > 1) {
                        quantityInput.value = value - 1;
                    }
                });
            }

            if (increaseBtn) {
                increaseBtn.addEventListener('click', () => {
                    let value = parseInt(quantityInput.value);
                    if (value < product.stock) {
                        quantityInput.value = value + 1;
                    }
                    else if (value >= product.stock) {
                         showMessage('No hay más stock disponible de este producto.', 'error');
                    }
                });
            }

            const addToCartButton = productDetailContainer.querySelector('.product-detail-add-to-cart');
            if (addToCartButton) {
                addToCartButton.addEventListener('click', async () => {
                    const quantityToAdd = parseInt(quantityInput.value);
                    if (quantityToAdd > 0 && quantityToAdd <= product.stock) {
                        await addProductToCart(product.id, quantityToAdd);
                    } else {
                        showMessage('Por favor, selecciona una cantidad válida.', 'error');
                    }
                });
            }

            // Fetch and render reviews (placeholder)
            await fetchAndRenderReviews(productId);
            // Fetch and render related products (placeholder)
            await fetchAndRenderRelatedProducts(product.category); // Assuming 'category' for related products

        } catch (err) {
            console.error('Error inesperado en fetchAndRenderProductDetail:', err);
            loadingMessage.style.display = 'none';
            errorMessage.style.display = 'block';
            errorMessage.textContent = 'Ocurrió un error inesperado al cargar los detalles. Por favor, intenta de nuevo.';
        }
    };

    // Placeholder function for fetching and rendering reviews
    const fetchAndRenderReviews = async (productId) => {
        // In a real application, you would fetch reviews from your database
        // For now, let's use some dummy data
        const dummyReviews = [
            { reviewer: "Ana Gómez", rating: 5, text: "¡Me encanta este producto! Es exactamente lo que necesitaba. Muy recomendado." },
            { reviewer: "Juan Pérez", rating: 4, text: "Buen producto en general, aunque la entrega fue un poco lenta. Cumple su función." },
            { reviewer: "María Lopez", rating: 5, text: "Excelente calidad y precio. ¡Volveré a comprar!" },
            { reviewer: "Carlos Ruiz", rating: 3, text: "Funciona bien, pero esperaba un poco más de durabilidad." },
        ];

        if (dummyReviews.length === 0) {
            reviewsList.innerHTML = '<p class="no-reviews">Aún no hay reseñas para este producto. ¡Sé el primero en escribir una!</p>';
            return;
        }

        reviewsList.innerHTML = dummyReviews.map(review => `
            <div class="review-item">
                <h4>${review.reviewer}</h4>
                <div class="stars">${renderStars(review.rating)}</div>
                <p>${review.text}</p>
            </div>
        `).join('');
    };

    // Handle review form submission
    if (reviewForm) {
        reviewForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const reviewerName = document.getElementById('reviewer-name').value;
            const reviewText = document.getElementById('review-text').value;
            const rating = parseInt(selectedRatingInput.value);

            if (rating === 0) {
                showMessage('Por favor, selecciona una calificación con estrellas.', 'error');
                return;
            }

            // In a real application, you would send this data to your backend
            console.log('Submitted Review:', { reviewerName, rating, reviewText, productId: getProductIdFromUrl() });
            showMessage('Gracias por tu reseña. Se ha enviado correctamente.', 'success');

            // Clear form
            reviewForm.reset();
            selectedRatingInput.value = 0;
            starRatingContainer.querySelectorAll('i').forEach(star => {
                star.classList.remove('fas');
                star.classList.add('far');
            });
            // Re-render reviews to show the new one (if not dynamic from backend)
            // await fetchAndRenderReviews(getProductIdFromUrl());
        });
    }

    // Placeholder function for fetching and rendering related products
    const fetchAndRenderRelatedProducts = async (currentProductCategory) => {
        // In a real application, you would fetch products from the same category
        // or based on tags, excluding the current product ID.
        // For now, let's fetch a few random products or simply all products
        // and filter them if possible.

        try {
            const { data: allProducts, error } = await supabase
                .from('products')
                .select('*');

            if (error) {
                console.error('Error fetching related products:', error.message);
                return;
            }

            // Filter out the current product and limit to a few related ones
            const currentProductId = getProductIdFromUrl();
            const relatedProducts = allProducts
                .filter(p => p.id !== currentProductId && p.category === currentProductCategory)
                .slice(0, 4); // Get up to 4 related products

            const relatedProductsList = document.getElementById('related-products-list');
            if (relatedProducts.length === 0) {
                relatedProductsList.innerHTML = '<p class="no-related-products">No se encontraron productos relacionados.</p>';
                return;
            }

            relatedProductsList.innerHTML = relatedProducts.map(product => `
                <div class="related-product-card">
                    <img src="${product.image_url}" alt="${product.name}">
                    <div class="related-product-card-info">
                        <h3>${product.name}</h3>
                        <p>$${product.price.toFixed(2)}</p>
                        <a href="product-detail.html?id=${product.id}" class="btn-view-details">Ver Detalles</a>
                    </div>
                </div>
            `).join('');

        } catch (err) {
            console.error('Error rendering related products:', err);
        }
    };


    const productId = getProductIdFromUrl();
    await fetchAndRenderProductDetail(productId);
    
    updateAuthUI();
    await updateCartCountDisplay();
});
