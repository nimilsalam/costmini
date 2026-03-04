export default function ScanLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
      <div className="text-center mb-8">
        <div className="h-9 bg-gray-200 rounded-lg w-72 mx-auto mb-2" />
        <div className="h-5 bg-gray-100 rounded w-96 mx-auto" />
      </div>
      <div className="border-2 border-dashed border-gray-200 rounded-2xl p-12">
        <div className="w-12 h-12 bg-gray-200 rounded-lg mx-auto mb-4" />
        <div className="h-6 bg-gray-200 rounded w-56 mx-auto mb-2" />
        <div className="h-4 bg-gray-100 rounded w-72 mx-auto" />
      </div>
      <div className="flex gap-4 mt-4">
        <div className="flex-1 h-16 bg-gray-100 rounded-xl" />
        <div className="flex-1 h-16 bg-gray-100 rounded-xl" />
      </div>
    </div>
  );
}
