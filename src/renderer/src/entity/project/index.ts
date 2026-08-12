export * from './Project'
export * from './ProjectForm'
export * from './ProjectChat'
export * from './ProjectDynamics'
export * from './ProjectPlan'
export * from './Subscribe'


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
    |-notes                       # 项目笔记
    |-subscribe                   # 订阅列表（博主 → 视频订阅）
      |-index.json                # 博主索引
      |-{bloggerId}               # 博主目录
        |-index.json              # 该博主的视频订阅索引
        |-{subscribeId}           # 视频订阅目录
          |-video.mp4             # 订阅视频
          |-audio.mp3             # 视频提取音频
          |-text.md               # 音频提取的文字
          |-summary.md            # ai进行的总结



*/
