import axios from "axios";
import configData from "../config.json" assert { type: "json" };
import getStoreInfo from "./get-store-info.js";


let businessCode;
let storeDomain ;


export default async function fetchUpProducts(session) {
  
    try {
        
        storeDomain = await getStoreInfo(session);
        businessCode = configData[storeDomain];
        let products=[];
        let currentPage=1;
       
        while(true){
          const response = await axios.post(
             `https://uzapointerp.uzahost.com/api/upecommerce/single-vendor/v1/all-products?business_code=${businessCode}&page=${currentPage}`
          );

          let responseData=response.data.data;
          for (const product of responseData){
              products.push(product)
          }
          
          // Check if there are more pages
          if (response.data.next_url) {
            currentPage++; // Move to the next page
          } else {
            return products;
            // break; // No more pages, exit the loop
          }
        }
  
      } catch (error) {
        throw new Error(
          "Error fetching products from Uzapoint API: " + error.message
        );
      }
 
}
