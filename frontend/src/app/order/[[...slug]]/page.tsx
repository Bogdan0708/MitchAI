import OrderClient from './OrderClient'

// Generate a single catch-all page for static export
export async function generateStaticParams() {
  return [{ slug: [] }]
}

export default function OrderPage() {
  return <OrderClient />
}
