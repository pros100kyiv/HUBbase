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
              <div className="relative w-9 h-9 md:w-12 md:h-12">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <defs>
                    <linearGradient id={`last-project-ring-${project.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={project.progress === 100 ? '#10B981' : '#8B5CF6'} stopOpacity="1" />
                      <stop offset="100%" stopColor={project.progress === 100 ? '#059669' : '#6366F1'} stopOpacity="0.9" />
                    </linearGradient>
                  </defs>
                  <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
                  <circle
                    cx="18"
                    cy="18"
                    r="14"
                    fill="none"
                    stroke={`url(#last-project-ring-${project.id})`}
                    strokeWidth="3"
                    strokeDasharray={`${(project.progress / 100) * 87.96} 87.96`}
                    strokeLinecap="round"
                    className="transition-all duration-500 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[9px] md:text-xs font-bold tabular-nums text-white">{project.progress}%</span>
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

