import { Suspense } from 'react'
import OrderClient from './OrderClient'

// Generate a single catch-all page for static export
export async function generateStaticParams() {
  return [{ slug: [] }]
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Loading menu...</p>
      </div>
    </div>
  )
}

export default function OrderPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <OrderClient />
    </Suspense>
  )
}
