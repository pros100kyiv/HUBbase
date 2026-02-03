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
      <h3 className="text-lg font-semibold text-black mb-4" style={{ letterSpacing: '-0.01em' }}>
        Last project's
      </h3>
      <div className="grid grid-cols-3 gap-4">
        {displayProjects.map((project) => (
          <div
            key={project.id}
            className="bg-gray-800 text-white rounded-xl p-6 relative"
            style={{ boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)' }}
          >
            <div className="absolute top-4 right-4">
              <div className="relative w-12 h-12">
                <svg className="w-12 h-12 transform -rotate-90">
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    fill="none"
                    stroke="#374151"
                    strokeWidth="4"
                  />
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    fill="none"
                    stroke={project.progress === 100 ? '#10B981' : '#6366F1'}
                    strokeWidth="4"
                    strokeDasharray={`${(project.progress / 100) * 125.6} 125.6`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-bold">{project.progress}%</span>
                </div>
              </div>
            </div>

            <h4 className="text-base font-semibold text-white mb-2 pr-16" style={{ letterSpacing: '-0.01em' }}>
              {project.title}
            </h4>
            
            <div className={`inline-block px-2 py-1 rounded text-xs font-medium mb-2 ${
              project.status === 'Completed' 
                ? 'bg-green-500/20 text-green-300' 
                : 'bg-blue-500/20 text-blue-300'
            }`}>
              {project.status}
            </div>

            {project.description && (
              <p className="text-sm text-gray-300 mt-2">{project.description}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

