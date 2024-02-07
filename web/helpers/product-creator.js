import { Shopify, DataType } from "@shopify/shopify-api";
import axios from "axios";
import configData from "../config.json" assert { type: "json" };
import getStoreInfo from "./get-store-info.js";
import admin from "firebase-admin";
import serviceAccount from "../serviceAccountKey.json" assert { type: "json" };

import { firebaseDatabase } from "../index.js";


// Access configuration variables
let businessCode;
let businessDataRef;


let addedProducts = []; // Variable to store added products

// Function to fetch all products from the external API
async function fetchAllProducts(page,businessCode) {
  try {
    const response = await axios.post(
      `https://uzapointerp.uzahost.com/api/upecommerce/single-vendor/v1/all-products?business_code=${businessCode}&page=${page}`
    );
    return response.data;
  } catch (error) {
    throw new Error(
      "Error fetching products from external API: " + error.message
    );
  }
}

// Function to add a product to Shopify
async function addProductToShopify(client, product) {
  try {
    const response = await client.post({
      path: "products",
      data: product,
      type: DataType.JSON,
    });



    return response.body.product;

  } catch (error) {
    throw new Error("Error adding product to Shopify: " + error.message);
  }
}

// Function to create or retrieve a collection in Shopify
async function getOrCreateCollection(client, collectionTitle) {
  try {
    // Check if the collection already exists
    const existingCollections = await client.get({
      path: "custom_collections",
      type: DataType.JSON,
    });

    const foundCollection = existingCollections.body.custom_collections.find(
      (collection) => collection.title === collectionTitle
    );

    if (foundCollection) {
      return foundCollection.id; // Collection already exists, return its ID
    } else {
      // Collection doesn't exist, create a new one
      const newCollection = await client.post({
        path: "custom_collections",
        data: {
          custom_collection: {
            title: collectionTitle,
          },
        },
        type: DataType.JSON,
      });

      return newCollection.body.custom_collection.id;
    }
  } catch (error) {
    throw error;
  }
}


// Function to create or retrieve a collection in Shopify
async function getOrCreateProductMetafield(client, product_id,product_up_code) {
  try {
    // /admin/api/2024-01/products/632910392/metafields/1001077698.json
    // Check if the metafield already exists
    const existingProductFields = await client.get({
      path:  `products/${product_id}/metafields`,
      type: DataType.JSON,
    });

    const foundMetafield = existingProductFields.body.metafields.find(
      (metafield) => metafield.value === product_up_code
    );

    if (foundMetafield) {
      return foundMetafield.id; // Meatfield already exists, return its ID
    } else {
      // Metafield doesn't exist, create a new one
      const newMetaField = await client.post({
        path: "metafields",
        data: {
          metafield: {
              "key": "up_id",
              "value": product_up_code,
              "type": "single_line_text_field",
              "namespace": "custom",
              "owner_resource": "product",
              "owner_id": `${product_id}`,
          },
        },

        type: DataType.JSON,
      });

      return newMetaField.body.metafield.id;
    }
  } catch (error) {
    throw error;
  }
}


// Function to add a product to a collection in Shopify
async function addProductToCollection(client, productId, collectionId) {
  try {
    // Check if the collection already exists
    const existingCollections = await client.get({
      path: "custom_collections",
      type: DataType.JSON,
    });

    const foundCollection = existingCollections.body.custom_collections.find(
      (collection) => collection.id === collectionId
    );

    if (foundCollection) {
      foundCollection.collects = [
        {
          product_id: productId,
        },
      ];
      // Now, update the collection using Shopify API
      await client.put({
        path: `custom_collections/${foundCollection.id}`,
        type: DataType.JSON,
        data: {
          custom_collection: foundCollection,
        },
      });

    } else {
      console.error("Collection not found.");
      
    }
  } catch (error) {
    throw error;
  }
}

export default async function productCreator(session) {
  try {
    const client = new Shopify.Clients.Rest(session.shop, session.accessToken);

    let storeDomain = await getStoreInfo(session);
    businessCode = configData[storeDomain];

    let currentPage = 1;
    // Check if a product with same label  already exists
    const existingProductsResponse = await client.get({
      path: "products",
      type: DataType.JSON,
    });
    const existingProducts = existingProductsResponse.body.products;

    while (true) {
      const results = await fetchAllProducts(currentPage,businessCode);
      const products = results.data;

      console.log("currentPage", currentPage);

      for (const product of products) {
        // Check if a product with the same label already exists in Shopify
        const foundProduct = existingProducts.find(
          (currentProduct) => currentProduct.title === product.label
        );
        
        if (foundProduct === undefined) {
          // Construct Shopify product payload
          const shopifyProduct = {
            product: {
              title: product.label,
              product_type: product.subcategory_name,
              body_html: product.product_description,
              images: [],
              published: true, // or false depending on your requirement
              tags: [product.category_name, product.subcategory_name],
              // variants: [],
              options: [],
              published: true,
            },
          };

          if (product.product_images && product.product_images.length > 0) {
            // Add product_images if it's not null and has at least one image
            shopifyProduct.product.images = product.product_images.map(
              (imageData) => ({
                src: imageData.image,
              })
            );
          } else {
            // Use the image property if product_images is null or empty
            shopifyProduct.product.images.push({ src: product.image });
          }


          if (product.has_variants) {
            shopifyProduct.product.variants = []; // Initialize variants array

            // Create a Set to store unique variant options
            const existingVariants = new Set();

            // Populate variants using all_variants
            product.variants.all_variants.forEach((variant) => {
              let option1 = ""; // Default value for option1
              let option2 = ""; // Default value for option2

              if (variant.color_name && variant.size_name) {
                option1 = variant.color_name;
                option2 = variant.size_name;
              } else if (variant.color_name && !variant.size_name) {
                option1 = variant.color_name;
              } else if (!variant.color_name && variant.size_name) {
                option1 = variant.size_name; // Assign variant.size_name to option1
              }

              const variantObject = {
                option1: option1,
              };

              // Only include option2 if it is not an empty string
              if (option2 !== "") {
                variantObject["option2"] = option2;
              }

              // Check if the variant already exists by converting it to JSON string
              if (!existingVariants.has(JSON.stringify(variantObject))) {
                shopifyProduct.product.variants.push(variantObject);
                existingVariants.add(JSON.stringify(variantObject)); // Add new variant to the Set
              }
            });

            if (product.variants.available_colors.length > 0) {
              // Populate options for colors
              shopifyProduct.product.options.push({
                name: "Color",
                values: product.variants.available_colors.map(
                  (color) => color.color_name
                ),
              });
            }

            if (product.variants.available_sizes.length > 0) {
              // Populate options for sizes
              shopifyProduct.product.options.push({
                name: "Size",
                values: product.variants.available_sizes.map(
                  (size) => size.size_name
                ),
              });
            }
          } else {
            // If the product has no variants, handle the default variant separately
            shopifyProduct.product.variants = [
              {
                title: "",
                price: product.price, // Set the price for the default variant
                option1: "", // Set default option
              },
            ];
          }

          // Add product to Shopify
          const createdProduct = await addProductToShopify(client, shopifyProduct);

          // Create or retrieve collection and add product to it
          const collectionId = await getOrCreateCollection(
            client,
            product.category_name
          );
          await addProductToCollection(client, createdProduct.id , collectionId);

          // Create or retrieve metafield and add product to it
          await getOrCreateProductMetafield(
            client,
            createdProduct.id,
            product.code
          );
         addedProducts.push(createdProduct); // Add product to variable
          
         //push created product to firebase
         businessDataRef = firebaseDatabase.ref(businessCode);
         await businessDataRef.push(addedProducts);


        } else {
          console.log(`Found existing product with label "${product.label}". Checking for updates...`);
        
          // Check if any properties have changed
          const hasPropertiesChanged = (
            foundProduct.title !== product.label ||
            foundProduct.product_type !== product.subcategory_name ||
            foundProduct.body_html !== product.product_description ||
            Math.floor(foundProduct.variants[0].price) !== product.price 
            // Add more comparisons for other fields if needed
          );
          if (hasPropertiesChanged) {
            console.log(`Changes detected. Updating product "${product.label}"...`);
        
            // Construct Shopify product payload for updating existing product
            const updateProductPayload = {
              product: {
                id: foundProduct.id,
                title: product.label,
                product_type: product.subcategory_name,
                body_html: product.product_description,
                tags: [product.category_name, product.subcategory_name],
              },
            };
        
            if (product.product_images && product.product_images.length > 0) {
              // Update product images if available
              updateProductPayload.product.images = product.product_images.map(
                (imageData) => ({
                  src: imageData.image,
                })
              );
            } else {
              // Use the existing image property if product_images is null or empty
              updateProductPayload.product.images = [{ src: product.image }];
            }
        
            try {
              // Update the existing product in Shopify
              const updatedProductResponse = await client.put({
                path: `products/${foundProduct.id}`,
                type: DataType.JSON,
                data: updateProductPayload,
              });
        
              const updatedProduct = updatedProductResponse.body.product;
              console.log(`Product "${product.label}" updated successfully.`);
              addedProducts.push(updatedProduct); // Add updated product to variable
              //push updated product to firebase
              businessDataRef = firebaseDatabase.ref(businessCode);
              await businessDataRef.push(addedProducts);
            } catch (error) {
              console.log("throw error",error)
              throw new Error("Error updating product in Shopify: " + error.message);
            }
          } else {
            console.log(`No changes detected. Skipping update for product "${product.label}".`);
          }
        }
        

      }
      // return addedProducts;

      // Check if there are more pages
      if (results.next_url) {
        currentPage++; // Move to the next page
      } else {
        return addedProducts
        // break; // No more pages, exit the loop
      }
    }
  } catch (error) {
    console.log("Problem creating product:", error);
    throw error;
  }
}
