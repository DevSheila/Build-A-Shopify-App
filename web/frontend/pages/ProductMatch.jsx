import React, { useState, useCallback, useEffect } from 'react';
import {
    Select,
    FormLayout,
    Button,
    Page,
    Layout,
    Toast,
    Frame,
    DataTable,
    Spinner
} from '@shopify/polaris';

import { TitleBar } from "@shopify/app-bridge-react";
import { useAppQuery, useAuthenticatedFetch } from "../hooks";

export default function ProductMatch() {
    const emptyToastProps = { content: null };
    const [toastProps, setToastProps] = useState(emptyToastProps);
    const [isLoading, setIsLoading] = useState(true);
    const [clickAddToTable, setClickAddToTable] = useState(false);
    const [upProducts, setUPProducts] = useState([]);
    const [shopifyProducts, setShopifyProducts] = useState([]);
    const [selectedUPproduct, setSelectedUPProduct] = useState('');
    const [selectedShopifyProduct, setSelectedShopifyProduct] = useState('');
    const [tableData, setTableData] = useState([]);

    const fetch = useAuthenticatedFetch();
    const shopifyOptions = [];
    const upOptions = [];

    useEffect(() => {
        setIsLoading(true);
        fetchShopifyProducts();
        fetchUzapointProducts();
    }, []);

    const toastMarkup = toastProps.content && (
        <Toast {...toastProps} onDismiss={() => setToastProps(emptyToastProps)} />
    );

    const handleUPSelectChange = useCallback(
        (value) => setSelectedUPProduct(value),
        [],
    );

    const handleShopifySelectChange = useCallback(
        (value) => setSelectedShopifyProduct(value),
        [],
    );
   
    const handleAddToTable = async () => {
      if (selectedUPproduct === '' || selectedShopifyProduct === '') {
          setToastProps({
              content: 'Please select both a Uzapoint product and a Shopify product.',
              error: true,
          });
      } else {
          const selectedShopifyProductLabel = shopifyProducts.find(option => option.value == selectedShopifyProduct)?.label || '';
  
          const selectedUpProductLabel = upProducts.find(option => option.value == selectedUPproduct)?.label || '';
  
          setClickAddToTable(true);
          const newTableData = [...tableData, { upProduct: selectedUpProductLabel , shopifyProduct: selectedShopifyProductLabel }];
          setTableData(newTableData);
      }

    };

    const handleMatchProducts = async () => {

        //get table data
        if (tableData.length === 0) {
            console.log("No products in the table to match.");
            return;
        }

        //get matched products
        let matchedProducts=[];

        tableData.forEach(row => {
            const selectedShopifyProductValue = shopifyProducts.find(option => option.label ==  row.shopifyProduct)?.value || '';
            const selectedUpProductValue = upProducts.find(option => option.label == row.upProduct)?.value || '';
            matchedProducts.push({shopify:selectedShopifyProductValue,uzapoint:selectedUpProductValue});
        });

        matchProducts(matchedProducts);

    };

    const matchProducts = async (matchedProducts) => {

        try{

        setIsLoading(true);
         //call match products endpoint
          const response = await fetch("/api/products/match-product", {
            method: 'POST',
            headers: {
            'Content-Type': 'application/json',
            },
            body: JSON.stringify({
             "matchedProducts": matchedProducts,
            }) });

            setToastProps({
                content: 'Products Matched Successfully',
            });

            setClickAddToTable(false);
            setTableData([]);

        }catch(error){
            setToastProps({
                content: `Error ${error}`,
            });
        }finally{
            setIsLoading(false);

        }

    }

  
    const fetchShopifyProducts = async () => {
        setIsLoading(true);
        try {
            const shopifyResponse = await fetch("/api/products");
            if (shopifyResponse.ok) {
                const data = await shopifyResponse.json();
                const shopifyProducts = data.products;

                for (const shopifyProduct of shopifyProducts) {
                    shopifyOptions.push({ label: shopifyProduct.title, value: shopifyProduct.id });
                }
                setShopifyProducts(shopifyOptions);
            } else {
                console.error("Failed to fetch Shopify products");
            }
        } catch (error) {
            console.error("Error fetching Shopify products:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchUzapointProducts = async () => {
        setIsLoading(true);
        try {
            const uzapointResponse = await fetch("/api/products/up-products");
            if (uzapointResponse.ok) {
                const data = await uzapointResponse.json();
                const uzapointProducts = data.products;

                for (const uzapointProduct of uzapointProducts) {
                    upOptions.push({ label: uzapointProduct.label, value: uzapointProduct.code });
                }
                setUPProducts(upOptions);
            } else {
                console.error("Failed to fetch Uzapoint products");
            }
        } catch (error) {
            console.error("Error fetching Uzapoint products:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const columns = [
        { header: 'Uzapoint Product', key: 'upProduct' },
        { header: 'Shopify Product', key: 'shopifyProduct' },
    ];

    return (
        <Frame>
            <Page>
                <TitleBar title="Products Matching" primaryAction={null} />
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
                            <FormLayout>
                                <FormLayout.Group condensed>
                                    <Select
                                        label="Select Uzapoint Product"
                                        options={upProducts}
                                        onChange={handleUPSelectChange}
                                        value={selectedUPproduct}
                                    />
                                    <Select
                                        label="Select Shopify Product"
                                        options={shopifyProducts}
                                        onChange={handleShopifySelectChange}
                                        value={selectedShopifyProduct}
                                    />
                                </FormLayout.Group>
                                <Button onClick={handleAddToTable} primary>Add To Table</Button>
                            </FormLayout>
                            {selectedUPproduct &&  selectedShopifyProduct && clickAddToTable? (


                            <div style={{ display: 'flex', flexDirection: 'column' , alignItems:"start",marginTop:"10px"}}>
                                <Button onClick={handleMatchProducts} primary>Match Products</Button>

                                <DataTable
                                    columnContentTypes={['text', 'text']}
                                    headings={columns.map(column => column.header)}
                                    rows={tableData.map((row, index) => {
                                        return [
                                            ...columns.map(column => row[column.key])
                                        ];
                                    })}
                                />
                            </div>


                            ) : (
                                <>
                                
                                </>
                            )}
                        </>
                        )}
                    </Layout.Section>
                </Layout>
            </Page>
        </Frame>
    );
}
