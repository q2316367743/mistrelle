export * from './Project'
export * from './ProjectForm'
export * from './ProjectChat'
export * from './ProjectDynamics'
export * from './ProjectTask'


/*
## 项目目录结构
~/.mistrelle

|- project
  |- index.json                   # 项目索引
  |- {projectId}
    |-files                       # 项目文件（资产）
    |-chat                        # 项目对话（对话）
      |- index.json               # 对话索引
      |- {chatId}                 # 对话目录
        |- message.json           # 对话消息
        |- files                  # 对话产物
    |-dynamics.json               # 动态列表（动态）
    |-tasks                       # 项目任务（任务）
      |- index.json               # 任务索引
      |- {taskId}                 # 任务目录
        |- index.json             # 任务索引，即任务信息
        |- files                  # 任务附件，在任务完成时，可能会提交附件




*/
