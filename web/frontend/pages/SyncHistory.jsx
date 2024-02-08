import { useState, useEffect, useMemo } from "react";
import {
  Card,
  Page,
  Layout,
  DataTable,
  Thumbnail,
  Pagination,
  EmptyState,
  Spinner,
  TextField,
  Button,
  Stack,
  Select,
  FormLayout,
  
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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDateTime, setSelectedDateTime] = useState(null);
  const [productFound, setProductFound] = useState(true); // Added state to track product not found
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
        // Sort products by updated_at in reverse order
        const sortedProducts = data.products.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
        setProducts(sortedProducts); // Set products state with fetched data
      } else {
        console.error("Failed to fetch products");
      }
    }catch(error){
      console.log("error",error);
    } finally {
      setIsLoading(false);
    }
  }


  const handleSearch = async () => {
    setIsLoading(true);
    setProductFound(true); // Reset product not found state
  
    try {
      const response = await fetch(`/api/products/search?query=${encodeURIComponent(searchQuery)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.products.length === 0) {
          setProductFound(false);
        } else {
          setProducts(data.products);
        }
      } else {
        console.error("Failed to fetch products");
      }
    } catch (error) {
      console.log("error", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDateTime = (dateTimeString) => {
    const dateTime = new Date(dateTimeString);
    const formattedDateTime = `${dateTime.getFullYear()}-${(dateTime.getMonth() + 1).toString().padStart(2, '0')}-${dateTime.getDate().toString().padStart(2, '0')} ${dateTime.getHours().toString().padStart(2, '0')}:${dateTime.getMinutes().toString().padStart(2, '0')}`;
    return formattedDateTime;
  };


  // Get unique dates and times from products
  const uniqueDateTimeOptions = [...new Set(products.map((product) => formatDateTime(product.updated_at)))].sort().reverse();

     // Function to handle date and time selection
  const handleDateTimeChange = (value) => {
    setSelectedDateTime(value);
    setCurrentPage(1); // Reset pagination when date/time changes
  };


    // Filter products based on selected date and time
    const filteredProducts = selectedDateTime
    ? products.filter((product) => formatDateTime(product.updated_at) === selectedDateTime)
    : products;

    // Get current products
    const indexOfLastProduct = currentPage * productsPerPage;
    const indexOfFirstProduct = indexOfLastProduct - productsPerPage;
    const currentProducts = filteredProducts.slice(indexOfFirstProduct, indexOfLastProduct);

    // Change page
    const paginate = (pageNumber) => setCurrentPage(pageNumber);

    const rows = currentProducts.map((product, index) => [
        index + 1 + indexOfFirstProduct, // Serial number
        product.image ? <Thumbnail source={product.image.src} alt={product.title} /> : null, // Check if image exists
        product.title? product.title : null,
        product.variants ? `KES ${product.variants[0].price}`: null,
        product.updated_at?  formatDateTime(product.updated_at) : null,
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
                {products.length > 0 &&  productFound? ( // Conditionally render if products exist or product  found message is displayed  
                
                  <Card title="Product Table" sectioned>
                    <Card title="Search Products" sectioned>
                        <FormLayout>

                          <TextField
                            value={searchQuery}
                            onChange={setSearchQuery}
                            placeholder="Search products..."
                            style={{ marginRight: '1rem' }}
                          />

                        <Select
                          options={uniqueDateTimeOptions.map((dateTime) => ({ label: dateTime, value: dateTime }))}
                          onChange={handleDateTimeChange}
                          value={selectedDateTime}
                          // Adjust width to fit content
                        />

                      <Button onClick={handleSearch} primary>Search</Button> 
                      </FormLayout>

                    </Card>
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
                    {products.length === 0 && !productFound ? ( // Empty state when no products exist
                      <EmptyState
                        heading="There is no sync history for your store"
                        // action={{ content: "Add transfer" }}
                        image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                      >
                        <p>Run the sync.</p>
                      </EmptyState>
                    ) : (
                      <Card title="Search Products" sectioned>
                        <FormLayout>

                          <TextField
                            value={searchQuery}
                            onChange={setSearchQuery}
                            placeholder="Search products..."
                            style={{ marginRight: '1rem' }}
                          />

                        <Select
                          options={uniqueDateTimeOptions.map((dateTime) => ({ label: dateTime, value: dateTime }))}
                          onChange={handleDateTimeChange}
                          value={selectedDateTime}
                          // Adjust width to fit content
                        />

                      <Button onClick={handleSearch} primary>Search</Button> 
                      </FormLayout>

                      <EmptyState // Empty state when product not found
                        heading="Product not found"
                        image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                      >
                        <p>No products match your search. Try again.</p>
                      </EmptyState>
                    </Card>
             
                    )}
                  </Card>
                )}
              </>
            )}
          </Layout.Section>
        </Layout>
      </Page>
    );
}
