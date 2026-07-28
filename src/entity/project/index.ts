export * from './Project'
export * from './ProjectForm'
export * from './ProjectChat'
export * from './ProjectDynamics'
export * from './ProjectPlan'


/*
## 项目目录结构
~/.mistrelle

|- project
  |- index.json                   # 项目索引
  |- {projectId}
    |-files                       # 项目文件（资产）
    |-plan                        # 项目计划（计划）
      |- index.json               # 计划索引
      |- {planId}                 # 计划目录
        |- plan.json              # 计划信息
        |- files                  # 计划产物
    |-dynamics.json               # 动态列表（动态）
    |-tasks                       # 项目任务（任务）
      |- index.json               # 任务索引
      |- {taskId}                 # 任务目录
        |- index.json             # 任务索引，即任务信息
        |- inputs                 # 任务附件，用户主动上传
        |- outputs                # 任务产物，在任务完成时，可能会生成产物




*/
