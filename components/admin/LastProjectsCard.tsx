'use client'

interface Project {
  id: string
  title: string
  progress: number
  status: 'In Progress' | 'Completed'
  description?: string
}

interface LastProjectsCardProps {
  projects: Project[]
}

export function LastProjectsCard({ projects }: LastProjectsCardProps) {
  const defaultProjects: Project[] = [
    { 
      id: '1', 
      title: 'New Schedule', 
      progress: 95, 
      status: 'In Progress',
      description: 'Done: Create a new and unique design for my youtube family.'
    },
    { 
      id: '2', 
      title: 'Anime Ui design', 
      progress: 100, 
      status: 'Completed'
    },
    { 
      id: '3', 
      title: 'Creative Ui design', 
      progress: 100, 
      status: 'Completed'
    },
  ]

  // Use provided projects if available, otherwise use default
  const displayProjects = projects && projects.length > 0 ? projects : defaultProjects

  return (
    <div>
      <h3 className="text-base md:text-lg font-semibold text-white mb-3 md:mb-4" style={{ letterSpacing: '-0.01em' }}>
        Last project's
      </h3>
      <div className="grid grid-cols-3 gap-2 md:gap-4">
        {displayProjects.map((project) => (
          <div
            key={project.id}
            className="bg-[#1A1A1A] text-white rounded-xl p-3 md:p-6 relative"
            style={{ boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px 0 rgba(0, 0, 0, 0.2)' }}
          >
            <div className="absolute top-2 right-2 md:top-4 md:right-4">
              <div className="relative w-8 h-8 md:w-12 md:h-12">
                <svg className="w-8 h-8 md:w-12 md:h-12 transform -rotate-90">
                  <circle
                    cx="16"
                    cy="16"
                    r="13"
                    fill="none"
                    stroke="#374151"
                    strokeWidth="3"
                  />
                  <circle
                    cx="16"
                    cy="16"
                    r="13"
                    fill="none"
                    stroke={project.progress === 100 ? '#10B981' : '#6366F1'}
                    strokeWidth="3"
                    strokeDasharray={`${(project.progress / 100) * 81.68} 81.68`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[8px] md:text-xs font-bold">{project.progress}%</span>
                </div>
              </div>
            </div>

            <h4 className="text-xs md:text-base font-semibold text-white mb-1 md:mb-2 pr-10 md:pr-16 line-clamp-2" style={{ letterSpacing: '-0.01em' }}>
              {project.title}
            </h4>
            
            <div className={`inline-block px-1.5 md:px-2 py-0.5 md:py-1 rounded text-[9px] md:text-xs font-medium mb-1 md:mb-2 ${
              project.status === 'Completed' 
                ? 'bg-green-500/20 text-green-300' 
                : 'bg-blue-500/20 text-blue-300'
            }`}>
              {project.status}
            </div>

            {project.description && (
              <p className="text-[10px] md:text-sm text-gray-300 mt-1 md:mt-2 line-clamp-2">{project.description}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

