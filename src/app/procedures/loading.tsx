export default function ProceduresLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
      <div className="h-9 bg-gray-200 rounded-lg w-72 mb-2" />
      <div className="h-5 bg-gray-100 rounded w-96 mb-8" />
      <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-6">
        <div className="h-12 bg-gray-100 rounded-xl mb-4" />
        <div className="flex gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 bg-gray-100 rounded-full w-24" />
          ))}
        </div>
      </div>
      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="h-4 bg-gray-100 rounded w-24 mb-2" />
            <div className="h-7 bg-gray-200 rounded w-64 mb-2" />
            <div className="h-4 bg-gray-100 rounded w-full mb-4" />
            <div className="space-y-3 mt-4">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="h-16 bg-gray-50 rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
