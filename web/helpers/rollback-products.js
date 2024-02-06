import { Shopify } from "@shopify/shopify-api";

export default async function rollbackProducts(selectedDateTime) {
  const client = new Shopify.Clients.Rest();
  const productsResponse = await client.get({
    path: "products",
    type: Shopify.DataType.JSON,
  });
  const products = productsResponse.body.products;

  const productsToUpdate = products.filter(
    (product) => new Date(product.updated_at) > new Date(selectedDateTime)
  );

  for (const product of productsToUpdate) {
    await updateProduct(client, product);
  }
}

async function updateProduct(client, product) {
  try {
    const { id, title, product_type, body_html, tags, images } = product;
    const updateProductPayload = {
      product: {
        id,
        title,
        product_type,
        body_html,
        tags,
        images,
      },
    };

    // Update products
    const response = await client.put({
      path: `products/${id}`,
      type: Shopify.DataType.JSON,
      data: updateProductPayload,
    });

    return response.body.product;
  } catch (error) {
    throw new Error("Error updating product in Shopify: " + error.message);
  }
}
