export default function MedicinesLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
      <div className="h-9 bg-gray-200 rounded-lg w-64 mb-2" />
      <div className="h-5 bg-gray-100 rounded w-96 mb-8" />
      <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-6 space-y-4">
        <div className="h-12 bg-gray-100 rounded-xl" />
        <div className="flex gap-3">
          <div className="h-9 bg-gray-100 rounded-lg w-36" />
          <div className="h-9 bg-gray-100 rounded-lg w-28" />
          <div className="h-9 bg-gray-100 rounded-lg w-28" />
        </div>
      </div>
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex justify-between">
              <div className="space-y-2 flex-1">
                <div className="h-6 bg-gray-200 rounded w-48" />
                <div className="h-4 bg-gray-100 rounded w-72" />
                <div className="h-3 bg-gray-100 rounded w-40" />
              </div>
              <div className="space-y-2 text-right">
                <div className="h-8 bg-gray-200 rounded w-20 ml-auto" />
                <div className="h-4 bg-gray-100 rounded w-16 ml-auto" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
