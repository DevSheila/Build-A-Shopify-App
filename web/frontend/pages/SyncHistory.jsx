import { useState,useEffect } from "react";
import {
  Card,
  Page,
  Layout,
  DataTable,
  Thumbnail,
  Pagination,
  EmptyState,
  Spinner,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { Toast } from "@shopify/app-bridge-react";
import { useAppQuery, useAuthenticatedFetch } from "../hooks";


export default function SyncHistory() {
  const emptyToastProps = { content: null };
  const [isLoading, setIsLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [toastProps, setToastProps] = useState(emptyToastProps);
  const [currentPage, setCurrentPage] = useState(1);
  const [productsPerPage] = useState(20); // 5 products per page
  const fetch = useAuthenticatedFetch();

  
  
  useEffect(() => {
    setIsLoading(true);
    fetchProducts(); // Fetch products when component mounts

  }, []); // Empty dependency array to run once on mount

  const toastMarkup = toastProps.content && !isRefetchingCount && (
    <Toast {...toastProps} onDismiss={() => setToastProps(emptyToastProps)} />
  );


  const fetchProducts = async () => {
    setIsLoading(true);
    try{
      const response = await fetch("/api/products/get-products");
      if (response.ok) {
        const data = await response.json();
        console.log("got products",data.products)
        setProducts(data.products); // Set products state with fetched data
      } else {
        console.error("Failed to fetch products");
      }
    }catch(error){
      console.log("error",error);
    } finally {
      setIsLoading(false);
    }
  }



  const formatDateTime = (dateTimeString) => {
    const dateTime = new Date(dateTimeString);
    const formattedDateTime = dateTime.toISOString().replace("T", " ").slice(0, -1);
    return formattedDateTime;
  };

    // Get current products
    const indexOfLastProduct = currentPage * productsPerPage;
    const indexOfFirstProduct = indexOfLastProduct - productsPerPage;
    const currentProducts = products.slice(indexOfFirstProduct, indexOfLastProduct);

    // Change page
    const paginate = (pageNumber) => setCurrentPage(pageNumber);
  

    const rows = currentProducts.map((product, index) => [
        index + 1 + indexOfFirstProduct, // Serial number
        product.image ? <Thumbnail source={product.image.src} alt={product.title} /> : null, // Check if image exists
        product.title,
        `KES ${product.variants[0].price}`,
        formatDateTime(product.updated_at),
      ]);
 
    return (
      <Page>
        <TitleBar title="Sync History" primaryAction={null} />
        <Layout>
          <Layout.Section>
            {toastMarkup}
            {isLoading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "300px" }}>
              <Spinner accessibilityLabel="Loading" size="large" color="teal" />
              <p>Please wait a moment ...</p>
            </div>
            ) : (
              <>
                {products.length > 0 ? ( // Conditionally render if products exist
                  <Card title="Product Table" sectioned>
                    <DataTable
                      columnContentTypes={["numeric", "text", "text", "text", "text"]}
                      headings={["#", "Title", "Image", "Price", "Update Date"]}
                      rows={rows}
                    />
                    <Pagination
                      hasPrevious={currentPage !== 1}
                      hasNext={indexOfLastProduct < products.length}
                      onPrevious={() => paginate(currentPage - 1)}
                      onNext={() => paginate(currentPage + 1)}
                    />
                  </Card>
                ) : (
                  <Card sectioned>
                    <EmptyState
                      heading="There is no sync history for your store"
                      // action={{ content: "Add transfer" }}
                      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                    >
                      <p>Run the sync.</p>
                    </EmptyState>
                  </Card>
                )}
              </>
            )}
          </Layout.Section>
        </Layout>
      </Page>
    );
    
    
}