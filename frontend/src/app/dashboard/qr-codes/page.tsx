'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { useAuth } from '@/contexts/auth-context'

interface Location {
  id: string
  name: string
  slug: string
  addressLine1?: string
  city?: string
  state?: string
  isPrimary: boolean
}

interface QRCode {
  id: string
  locationId: string
  locationName: string
  tableNumber?: string
  orderUrl: string
  createdAt: string
  scans: number
  lastScanned?: string
}

export default function QRCodesPage() {
  const { tenant } = useAuth()
  const [locations, setLocations] = useState<Location[]>([])
  const [qrCodes, setQRCodes] = useState<QRCode[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Build order URL based on tenant slug
  const buildOrderUrl = useCallback((locationSlug?: string, tableNumber?: string) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://app.mitch-ai.com'
    let url = `${baseUrl}/order/${tenant?.slug || 'menu'}`
    if (locationSlug) url += `/${locationSlug}`
    if (tableNumber) url += `?table=${tableNumber}`
    return url
  }, [tenant?.slug])

  // Fetch locations and generate QR code entries
  const fetchLocations = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await api.getLocations()
      if (response.data) {
        const mappedLocations: Location[] = response.data.map((loc: any) => ({
          id: loc.id,
          name: loc.name,
          slug: loc.slug,
          addressLine1: loc.addressLine1,
          city: loc.city,
          state: loc.state,
          isPrimary: loc.isPrimary,
        }))
        setLocations(mappedLocations)

        // Generate QR code entries for each location
        const generatedQRCodes: QRCode[] = mappedLocations.map(loc => ({
          id: `qr-${loc.id}`,
          locationId: loc.id,
          locationName: loc.name,
          orderUrl: buildOrderUrl(loc.slug),
          createdAt: new Date().toISOString().split('T')[0],
          scans: 0, // Would need analytics endpoint to get real scan data
        }))
        setQRCodes(generatedQRCodes)
      }
    } catch (err) {
      console.error('Failed to fetch locations:', err)
      setError('Failed to load locations. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [buildOrderUrl])

  useEffect(() => {
    fetchLocations()
  }, [fetchLocations])
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [showPreviewModal, setShowPreviewModal] = useState<QRCode | null>(null)
  const [newQRLocation, setNewQRLocation] = useState('')
  const [newQRTable, setNewQRTable] = useState('')
  const [bulkStart, setBulkStart] = useState('')
  const [bulkEnd, setBulkEnd] = useState('')
  const [generatingBulk, setGeneratingBulk] = useState(false)
  const [selectedQRs, setSelectedQRs] = useState<string[]>([])

  const totalScans = qrCodes.reduce((sum, qr) => sum + qr.scans, 0)
  const uniqueLocations = Array.from(new Set(qrCodes.map(qr => qr.locationId))).length

  const generateQRCode = async () => {
    const location = locations.find(l => l.id === newQRLocation)
    if (!location) return

    try {
      // Call API to generate QR code (if backend supports it)
      await api.generateQRCode(newQRLocation, { tableNumber: newQRTable || undefined })
    } catch (err) {
      // QR code generation might not require backend - just create the URL
      console.log('Generating QR code locally')
    }

    const newQR: QRCode = {
      id: `qr-${Date.now()}`,
      locationId: newQRLocation,
      locationName: location.name,
      tableNumber: newQRTable || undefined,
      orderUrl: buildOrderUrl(location.slug, newQRTable || undefined),
      createdAt: new Date().toISOString().split('T')[0],
      scans: 0,
    }

    setQRCodes([...qrCodes, newQR])
    setShowGenerateModal(false)
    setNewQRLocation('')
    setNewQRTable('')
  }

  const generateBulkQRCodes = async () => {
    if (!newQRLocation || !bulkStart || !bulkEnd) return

    setGeneratingBulk(true)
    const location = locations.find(l => l.id === newQRLocation)
    if (!location) {
      setGeneratingBulk(false)
      return
    }

    const start = parseInt(bulkStart)
    const end = parseInt(bulkEnd)
    const newCodes: QRCode[] = []

    for (let i = start; i <= end; i++) {
      newCodes.push({
        id: `qr-${Date.now()}-${i}`,
        locationId: newQRLocation,
        locationName: location.name,
        tableNumber: i.toString(),
        orderUrl: buildOrderUrl(location.slug, i.toString()),
        createdAt: new Date().toISOString().split('T')[0],
        scans: 0,
      })
    }

    setQRCodes([...qrCodes, ...newCodes])
    setGeneratingBulk(false)
    setShowGenerateModal(false)
    setBulkStart('')
    setBulkEnd('')
    setNewQRLocation('')
  }

  const deleteQRCode = (id: string) => {
    setQRCodes(qrCodes.filter(qr => qr.id !== id))
  }

  const toggleSelect = (id: string) => {
    setSelectedQRs(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const selectAll = () => {
    if (selectedQRs.length === qrCodes.length) {
      setSelectedQRs([])
    } else {
      setSelectedQRs(qrCodes.map(qr => qr.id))
    }
  }

  const downloadSelected = () => {
    // In real implementation, this would generate and download QR codes
    alert(`Downloading ${selectedQRs.length} QR codes...`)
    setSelectedQRs([])
  }

  const printSelected = () => {
    // In real implementation, this would open print dialog
    alert(`Preparing ${selectedQRs.length} QR codes for printing...`)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const formatLastScanned = (dateStr?: string) => {
    if (!dateStr) return 'Never'
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    if (hours < 1) return 'Just now'
    if (hours < 24) return `${hours}h ago`
    return formatDate(dateStr)
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">QR Code Ordering</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Generate and manage QR codes for contactless ordering
          </p>
        </div>
        <button
          onClick={() => setShowGenerateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Generate QR Code
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
              <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{qrCodes.length}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Active QR Codes</div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{totalScans.toLocaleString()}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Total Scans</div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{uniqueLocations}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Locations</div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{qrCodes.filter(qr => qr.tableNumber).length}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Table QR Codes</div>
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-700 dark:text-red-300">{error}</p>
          <button
            onClick={fetchLocations}
            className="mt-2 text-sm text-red-600 dark:text-red-400 underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-12 shadow-sm border border-gray-200 dark:border-gray-700 mb-6 text-center">
          <svg className="animate-spin h-8 w-8 text-indigo-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-gray-500 dark:text-gray-400">Loading locations and QR codes...</p>
        </div>
      )}

      {/* Bulk Actions */}
      {!isLoading && selectedQRs.length > 0 && (
        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4 mb-6 flex items-center justify-between">
          <span className="text-indigo-700 dark:text-indigo-300 font-medium">
            {selectedQRs.length} QR code{selectedQRs.length > 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2">
            <button
              onClick={downloadSelected}
              className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-indigo-300 dark:border-indigo-700 rounded-lg text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-sm font-medium"
            >
              Download All
            </button>
            <button
              onClick={printSelected}
              className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
            >
              Print All
            </button>
          </div>
        </div>
      )}

      {/* QR Codes List */}
      {!isLoading && (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedQRs.length === qrCodes.length && qrCodes.length > 0}
                    onChange={selectAll}
                    className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">QR Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Location</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Table</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Scans</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Last Scanned</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Created</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {qrCodes.map((qr) => (
                <tr key={qr.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={selectedQRs.includes(qr.id)}
                      onChange={() => toggleSelect(qr.id)}
                      className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => setShowPreviewModal(qr)}
                      className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      {/* QR Code Placeholder */}
                      <svg className="w-12 h-12 text-gray-600 dark:text-gray-300" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M3 3h6v6H3V3zm2 2v2h2V5H5zm8-2h6v6h-6V3zm2 2v2h2V5h-2zM3 13h6v6H3v-6zm2 2v2h2v-2H5zm13-2h1v1h-1v-1zm-3 0h1v3h-1v-3zm-2 0h1v1h-1v-1zm5 2h1v1h-1v-1zm-2 2h1v1h-1v-1zm2 0h3v3h-1v-2h-2v-1zm0-4h3v1h-3v-1z"/>
                      </svg>
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{qr.locationName}</div>
                  </td>
                  <td className="px-6 py-4">
                    {qr.tableNumber ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                        Table {qr.tableNumber}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                        General
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-900 dark:text-white font-medium">{qr.scans}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-500 dark:text-gray-400">{formatLastScanned(qr.lastScanned)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-500 dark:text-gray-400">{formatDate(qr.createdAt)}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setShowPreviewModal(qr)}
                        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        title="Preview"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                      <button
                        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        title="Download"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </button>
                      <button
                        onClick={() => deleteQRCode(qr.id)}
                        className="p-2 text-gray-400 hover:text-red-600"
                        title="Delete"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Generate Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-xl">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Generate QR Code</h2>
                <button
                  onClick={() => setShowGenerateModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location</label>
                  <select
                    value={newQRLocation}
                    onChange={(e) => setNewQRLocation(e.target.value)}
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="">Select a location</option>
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                </div>

                <div className="border-b dark:border-gray-700 pb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Table Number (Optional)
                  </label>
                  <input
                    type="text"
                    value={newQRTable}
                    onChange={(e) => setNewQRTable(e.target.value)}
                    placeholder="e.g., 1"
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Or Generate Bulk Table QR Codes</div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">From Table</label>
                      <input
                        type="number"
                        value={bulkStart}
                        onChange={(e) => setBulkStart(e.target.value)}
                        placeholder="1"
                        min="1"
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">To Table</label>
                      <input
                        type="number"
                        value={bulkEnd}
                        onChange={(e) => setBulkEnd(e.target.value)}
                        placeholder="20"
                        min="1"
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                {bulkStart && bulkEnd ? (
                  <button
                    onClick={generateBulkQRCodes}
                    disabled={!newQRLocation || generatingBulk}
                    className="flex-1 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {generatingBulk ? 'Generating...' : `Generate ${Math.max(0, parseInt(bulkEnd) - parseInt(bulkStart) + 1)} QR Codes`}
                  </button>
                ) : (
                  <button
                    onClick={generateQRCode}
                    disabled={!newQRLocation}
                    className="flex-1 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Generate QR Code
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-xl">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">QR Code Preview</h2>
                <button
                  onClick={() => setShowPreviewModal(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="text-center">
                {/* QR Code Display */}
                <div className="bg-white p-6 rounded-xl inline-block mb-4">
                  <div className="w-48 h-48 bg-gray-100 rounded-lg flex items-center justify-center">
                    <svg className="w-40 h-40 text-gray-800" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3 3h6v6H3V3zm2 2v2h2V5H5zm8-2h6v6h-6V3zm2 2v2h2V5h-2zM3 13h6v6H3v-6zm2 2v2h2v-2H5zm13-2h1v1h-1v-1zm-3 0h1v3h-1v-3zm-2 0h1v1h-1v-1zm5 2h1v1h-1v-1zm-2 2h1v1h-1v-1zm2 0h3v3h-1v-2h-2v-1zm0-4h3v1h-3v-1z"/>
                    </svg>
                  </div>
                </div>

                <div className="mb-6">
                  <div className="text-lg font-bold text-gray-900 dark:text-white">{showPreviewModal.locationName}</div>
                  {showPreviewModal.tableNumber && (
                    <div className="text-indigo-600 dark:text-indigo-400 font-medium">Table {showPreviewModal.tableNumber}</div>
                  )}
                </div>

                <div className="text-xs text-gray-500 dark:text-gray-400 mb-6 break-all">
                  {showPreviewModal.orderUrl}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button className="py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                    Download PNG
                  </button>
                  <button className="py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors">
                    Print
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
