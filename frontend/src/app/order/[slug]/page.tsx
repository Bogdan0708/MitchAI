import OrderClient from './OrderClient'

// Generate empty params for static export - page renders client-side
export function generateStaticParams() {
  return []
}

// Enable dynamic params for client-side routing
export const dynamicParams = true

export default function OrderPage() {
  return <OrderClient />
}
