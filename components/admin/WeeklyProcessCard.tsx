'use client'

interface WeeklyProcessCardProps {
  data?: Array<{ day: string; work: number; meditation: number }>
}

export function WeeklyProcessCard({ data }: WeeklyProcessCardProps) {
  // Default data if not provided
  const defaultData = [
    { day: 'M', work: 60, meditation: 30 },
    { day: 'T', work: 70, meditation: 40 },
    { day: 'W', work: 65, meditation: 35 },
    { day: 'T', work: 80, meditation: 45 },
    { day: 'F', work: 75, meditation: 50 },
    { day: 'S', work: 50, meditation: 30 },
    { day: 'S', work: 40, meditation: 25 },
  ]

  const chartData = data || defaultData
  const maxValue = Math.max(...chartData.flatMap(d => [d.work, d.meditation]))

  return (
    <div className="bg-white rounded-xl p-6 card-floating">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-black" style={{ letterSpacing: '-0.01em' }}>
          Weekly process
        </h3>
        <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-black"></div>
          <span className="text-xs text-gray-600">Work</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-gray-400"></div>
          <span className="text-xs text-gray-600">Meditation</span>
        </div>
      </div>

      {/* Chart */}
      <div className="relative h-32">
        <svg className="w-full h-full" viewBox="0 0 300 100" preserveAspectRatio="none">
          {/* Work line */}
          <polyline
            points={chartData.map((d, i) => `${(i * 300) / (chartData.length - 1)},${100 - (d.work / maxValue) * 80}`).join(' ')}
            fill="none"
            stroke="#000000"
            strokeWidth="2"
          />
          {/* Meditation line */}
          <polyline
            points={chartData.map((d, i) => `${(i * 300) / (chartData.length - 1)},${100 - (d.meditation / maxValue) * 80}`).join(' ')}
            fill="none"
            stroke="#9CA3AF"
            strokeWidth="2"
          />
          {/* 65% label on Thursday */}
          <text x="170" y="25" fontSize="10" fill="#000000" fontWeight="600">65%</text>
        </svg>
      </div>

      {/* Days */}
      <div className="flex justify-between mt-2">
        {chartData.map((d, i) => (
          <div key={i} className="text-xs text-gray-600 font-medium">
            {d.day}
          </div>
        ))}
      </div>
    </div>
  )
}

