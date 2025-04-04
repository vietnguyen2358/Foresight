export default function Stats() {
    const stats = [
      { value: "600K+", label: "People go missing annually in the U.S." },
      { value: "95%", label: "Accuracy in person detection" },
      { value: "3-5x", label: "Faster than manual search methods" },
      { value: "24/7", label: "Real-time monitoring capabilities" },
    ]
  
    return (
      <div className="bg-blue-900 py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-4xl md:text-5xl font-bold text-white mb-2">{stat.value}</div>
                <div className="text-blue-200">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }
  
  