import fs from 'fs/promises';
import path from 'path';

interface FileCleanerConfig {
  targetDir: string;
  extensions: string[];
  dryRun: boolean;
  verbose: boolean;
  excludeDirs?: string[];
}

class FileCleaner {
  private deletedCount: number = 0;
  private errorCount: number = 0;
  private foundFiles: string[] = [];

  constructor(private config: FileCleanerConfig) {
  }

  /**
   * 检查是否应该排除该目录
   */
  private shouldExcludeDir(dirName: string): boolean {
    if (!this.config.excludeDirs) return false;
    return this.config.excludeDirs.includes(dirName);
  }

  /**
   * 递归清理文件
   */
  async clean(): Promise<void> {
    const absolutePath = path.resolve(this.config.targetDir);

    this.printHeader(absolutePath);

    // 检查目录是否存在
    await this.checkDirectory(absolutePath);

    // 开始清理
    await this.cleanDirectory(absolutePath);

    // 打印结果
    this.printResults();
  }

  private printHeader(absolutePath: string): void {
    console.log('='.repeat(60));
    console.log(`文件清理工具`);
    console.log('='.repeat(60));
    console.log(`目标目录: ${absolutePath}`);
    console.log(`文件类型: ${this.config.extensions.join(', ')}`);
    console.log(`模式: ${this.config.dryRun ? '预览模式（不会实际删除）' : '删除模式'}`);
    if (this.config.excludeDirs?.length) {
      console.log(`排除目录: ${this.config.excludeDirs.join(', ')}`);
    }
    console.log('='.repeat(60));
  }

  private async checkDirectory(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      throw new Error(`目录不存在: ${dirPath}`);
    }
  }

  private async cleanDirectory(dirPath: string): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, {withFileTypes: true});

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          // 检查是否需要排除该目录
          if (this.shouldExcludeDir(entry.name)) {
            if (this.config.verbose) {
              console.log(`⏭ 跳过目录: ${fullPath}`);
            }
            continue;
          }
          await this.cleanDirectory(fullPath);
        } else if (entry.isFile()) {
          await this.processFile(entry.name, fullPath);
        }
      }
    } catch (err) {
      const error = err as Error;
      console.error(`✗ 处理目录失败: ${dirPath}`, error.message);
      this.errorCount++;
    }
  }

  private async processFile(fileName: string, fullPath: string): Promise<void> {
    const shouldDelete = this.config.extensions.some(ext =>
      fileName.endsWith(ext)
    );

    if (shouldDelete) {
      this.foundFiles.push(fullPath);

      if (!this.config.dryRun) {
        try {
          await fs.unlink(fullPath);
          this.deletedCount++;
          if (this.config.verbose) {
            console.log(`✓ 已删除: ${fullPath}`);
          }
        } catch (err) {
          const error = err as Error;
          console.error(`✗ 删除失败: ${fullPath}`, error.message);
          this.errorCount++;
        }
      } else if (this.config.verbose) {
        console.log(`○ [预览] 将删除: ${fullPath}`);
      }
    }
  }

  private printResults(): void {
    console.log('='.repeat(60));

    if (this.config.dryRun) {
      console.log(`找到 ${this.foundFiles.length} 个待删除文件:`);
      if (this.foundFiles.length > 0 && !this.config.verbose) {
        this.foundFiles.forEach(file => {
          console.log(`  - ${file}`);
        });
      }
      console.log('\n提示: 这是预览模式');
      console.log(`将 dryRun 设为 false 即可实际删除文件`);
    } else {
      console.log(`✓ 成功删除: ${this.deletedCount} 个文件`);
      if (this.errorCount > 0) {
        console.log(`✗ 失败: ${this.errorCount} 个文件`);
      }
    }

    console.log('='.repeat(60));
  }
}

// 使用示例
async function main() {
  const cleaner = new FileCleaner({
    targetDir: './src-utools',           // 目标目录
    extensions: ['.js.gz', '.map'], // 要删除的扩展名
    dryRun: false,                   // true: 预览, false: 实际删除
    verbose: true,                  // 是否显示详细信息
    excludeDirs: ['.git'] // 排除的目录（可选）
  });

  await cleaner.clean();
}

// 运行
main().catch(err => {
  console.error('脚本执行失败:', err);
  process.exit(1);
});
