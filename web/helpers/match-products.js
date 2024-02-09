import { Shopify, DataType } from "@shopify/shopify-api";


// Function to create or retrieve a collection in Shopify
async function getOrCreateProductMetafield(client, product_id,product_up_code) {
    try {
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

export default async function matchProducts(session, matchedProducts){

    const client = new Shopify.Clients.Rest(session.shop, session.accessToken);

    try{

        console.log("matchedProducts",matchedProducts);
        for (const product of matchedProducts){
             // Create or retrieve metafield and add product to it
            let createMetafields=await getOrCreateProductMetafield(
                client,
                product.shopify,
                product.uzapoint,
                );

                console.log(createMetafields)
        }
       
    }catch(error){
        throw error;
    }

}

