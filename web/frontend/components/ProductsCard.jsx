import { useState } from "react";
import {
  Card,
  Heading,
  TextContainer,
  DisplayText,
  TextStyle,
  Form, 
  Button,
  FormLayout ,
  DataTable,
  Thumbnail,
} from "@shopify/polaris";
import { Toast } from "@shopify/app-bridge-react";
import { useAppQuery, useAuthenticatedFetch } from "../hooks";

export function ProductsCard() {
  const emptyToastProps = { content: null };
  const [isLoading, setIsLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [toastProps, setToastProps] = useState(emptyToastProps);
  const fetch = useAuthenticatedFetch();

  const {
    data,
    refetch: refetchProductCount,
    isLoading: isLoadingCount,
    isRefetching: isRefetchingCount,
  } = useAppQuery({
    url: "/api/products/count",
    reactQueryOptions: {
      onSuccess: () => {
        setIsLoading(false);
      },
    },
  });

  const toastMarkup = toastProps.content && !isRefetchingCount && (
    <Toast {...toastProps} onDismiss={() => setToastProps(emptyToastProps)} />
  );

  const handlePopulate = async () => {
    setIsLoading(true);
    var responseClone; // 1

    fetch("/api/products/create")
    .then(function (response) {
        responseClone = response.clone(); // 2
        return response.json();
    })
    .then(function (data) {

      console.log(data)
      setProducts(data);
      setIsLoading(false);
      refetchProductCount();
   
      setToastProps({ content: "All products are now up to date!"});
      

        // Do something with data
    }, function (rejectionReason) { // 3
        setToastProps({
          content: "There was an error creating products",
          error: true,
        });
        console.log('Error parsing JSON from response:', rejectionReason, responseClone); // 4
        responseClone.text() // 5
        .then(function (bodyText) {
            console.log('Received the following instead of valid JSON:', bodyText); // 6
        });
    });

  }


  const rows = products.map((product, index) => [
    index + 1, // Serial number
    product.image ? <Thumbnail source={product.image.src} alt={product.title} /> : null, // Check if image exists
    product.title,
    `KES ${product.variants[0].price}`,
    
  ]);
 
  return (
    <>
      {toastMarkup}
      <Card
        title="Sync Products"
        sectioned
        primaryFooterAction={{
          content: "Populate Products",
          onAction: handlePopulate,
          loading: isLoading,
        }}
      >
        <TextContainer spacing="loose">
          <p>
            Populate and update products from your Uzapoint account to this store.
          </p>
          <Heading element="h4">
            TOTAL PRODUCTS
            <DisplayText size="medium">
              <TextStyle variation="strong">
                {isLoadingCount ? "-" : data.count}
              </TextStyle>
            </DisplayText>
          </Heading>
        </TextContainer>
      </Card>

      {products.length > 0 && ( // Conditionally render if products exist
        <Card title="Product Table" sectioned>
          <DataTable
            columnContentTypes={["numeric", "text", "text", "text"]}
            headings={["#", "Image", "Title",  "Price"]}
            rows={rows}
          />
        </Card>
      )}
    </>
  );
}