---
layout: page
title: PaperCache - 机器学习与AI资源
description: 深度学习、机器学习和人工智能研究论文与笔记的完整集合
---

# 欢迎来到 PaperCache

一个关于**深度学习**、**机器学习**和**人工智能**的完整笔记、教程和资源集合。

## 🤖 大语言模型 (LLM)

### 算法研究
- **模型架构**: Transformer变体、注意力机制、位置编码
- **预训练方法**: MLM、CLM、多任务预训练
- **强化学习**: RLHF、PPO、DPO、对齐技术

### 工程实践
- **训练优化**: 分布式训练、内存优化、混合精度
- **推理加速**: 量化、剪枝、知识蒸馏
- **系统设计**: 成本效益、可扩展性、部署策略

## 🎨 扩散模型

- **扩散过程**: 前向和反向扩散、噪声调度
- **应用领域**: 图像生成、文本到图像合成、音频生成
- **优化技术**: 采样加速、训练效率、条件生成

## ⚙️ 机器学习系统

- **系统架构**: 分布式计算框架、资源管理
- **数据管理**: 数据流水线、特征存储、数据版本控制
- **模型服务**: 模型部署、服务架构、监控和可观测性

## 📚 论文列表

### 推理优化
- **[2025-07] [Step 3: Large yet Affordable Model System Co-design for Cost-effective Decoding](/llm/engineering/inference/2025-07-Step-3-is-Large-yet-Affordable-Model-system-Co-design-for-Cost-effective-Decoding.html)** - 成本效益模型解码的系统协同设计
- **[2025-07] [MegaScale: Infer Serving Mixture of Experts at Scale with Disaggregated Expert Parallelism](/llm/engineering/inference/2025-07-MegaScale-Infer-Serving-Mixture-of-Experts-at-Scale-with-Disaggregated-Expert-Parallelism.html)** - 大规模专家混合模型的推理服务
- **[2025-05] [Insights into DeepSeek V3: Scaling Challenges and Reflections on Hardware for AI Architecture](/llm/engineering/inference/2025-05-Insights-into-DeepSeek-V3-Scaling-Challenges-and-Reflections-on-Hardware-for-AI-Architecture.html)** - DeepSeek V3的扩展挑战与AI架构硬件思考
- **[2025-04] [Tilus: A Virtual Machine for Arbitrary Low-Precision GPGPU Computation in LLM Serving](/llm/engineering/inference/2025-04-Tilus-A-Virtual-Machine-for-Arbitrary-Low-Precision-GPGPU-Computation-in-LLM-Serving.html)** - LLM服务中任意低精度GPGPU计算的虚拟机
- **[2025-04] [CacheGen: KV Cache Compression and Streaming for Fast Large Language Model Serving](/llm/engineering/inference/2025-04-CacheGen-KV-Cache-Compression-and-Streaming-for-Fast-Large-Language-Model-Serving.html)** - KV缓存压缩和流式传输的快速大语言模型服务
- **[2025-04] [CacheBlend: Fast Large Language Model Serving for RAG with Cached Knowledge Fusion](/llm/engineering/inference/2025-04-CacheBlend-Fast-Large-Language-Model-Serving-for-RAG-with-Cached-Knowledge-Fusion.html)** - 基于缓存知识融合的快速大语言模型RAG服务
- **[2024-10] [Do Large Language Models Need a Content Delivery Network?](/llm/engineering/inference/2024-10-Do-Large-Language-Models-Need-a-Content-Delivery-Network.html)** - 大语言模型是否需要内容分发网络？
- **[2023-09] [Efficient Memory Management for Large Language Model Serving with PagedAttention](/llm/engineering/inference/2023-09-Efficient-Memory-Management-for-Large-Language-Model-Serving-with-PagedAttention.html)** - 基于分页注意力的大语言模型服务内存管理
- **[2023-08] [SARATHI: Efficient LLM Inference by Piggybacking Decodes with Chunked Prefills](/llm/engineering/inference/2023-08-SARATHI-Efficient-LLM-Inference-by-Piggybacking-Decodes-with-Chunked-Prefills.html)** - 通过分块预填充捎带解码的高效LLM推理
- **[2022-07] [Orca: A Distributed Serving System for Transformer-Based Generative Models](/llm/engineering/inference/2022-07-Orca-A-Distributed-Serving-System-for-Transformer-Based-Generative-Models.html)** - 基于Transformer的生成模型分布式服务系统

### 训练优化
- **[2024-02] [MegaScale: Scaling Large Language Model Training to 10K GPUs](/llm/engineering/train/2024-02-MegaScale-Scaling-Large-Language-Model-Training-to.html)** - 扩展到10K GPU的大语言模型训练
- **[2023-11] [ZERO BUBBLE PIPELINE PARALLELISM](/llm/engineering/train/2023-11-ZERO-BUBBLE-PIPELINE-PARALLELISM.html)** - 零气泡流水线并行训练技术

### 预训练方法
- **[2022-03] [Tensor Programs V: Tuning Large Neural Networks via Zero-Shot Hyperparameter Transfer](/llm/algorithm/pretrain/2022-03-Tensor-Programs-V-Tuning-Large-Neural-Networks-via-Zero-Shot-Hyperparameter-Transfer.html)** - 通过零样本超参数迁移调优大型神经网络

### 强化学习
- **[2024-10] [HybridFlow: A Flexible and Efficient RLHF Framework](/llm/algorithm/RL/2024-10-HybridFlow-A-Flexible-and-Efficient-RLHF-Framework.html)** - 灵活高效的RLHF框架

### GPU加速与编译器优化
- **[2025-06] [SAGEATTENTION: ACCURATE 8-BIT ATTENTION FOR PLUG-AND-PLAY INFERENCE ACCELERATION](/llm/engineering/gpu_acceleration/2025-06-SAGEATTENTION-ACCURATE-8-BIT-ATTENTION-FOR-PLUG-AND-PLAY-INFERENCE-ACCELERATION.html)** - 即插即用推理加速的精确8位注意力机制
- **[2025-06] [Mirage: A Multi-Level Superoptimizer for Tensor Programs](/llm/engineering/gpu_acceleration/2025-06-Mirage-A-Multi-Level-Superoptimizer-for-Tensor-Programs.html)** - 张量程序的多级超级优化器
- **[2024-07] [FlashAttention 3: Fast and Accurate Attention with Asynchrony and Low-precision](/llm/engineering/gpu_acceleration/2024-07-FlashAttention-3-Fast-and-Accurate-Attention-with-Asynchrony-and-Low-precision.html)** - 异步和低精度的快速精确注意力机制
- **[2022-07] [FlashAttention: Fast and Memory Efficient Exact Attention with IO-Awareness](/llm/engineering/gpu_acceleration/2022-07-FlashAttention-Fast-and-Memory-Efficient-Exact-Attention-with-IO-Awareness.html)** - 具有IO感知的快速内存高效精确注意力机制

### 编译器与编程模型
- **[2025-04] [TileLang: A Composable Tiled Programming Model for AI Systems](/llm/engineering/compiler/2025-04-TileLang-A-Composable-Tiled-Programming-Model-for-AI-Systems.html)** - AI系统的可组合瓦片编程模型
- **[2024-12] [FLEX ATTENTION: A PROGRAMMING MODEL FOR GENERATING OPTIMIZED ATTENTION KERNELS](/llm/engineering/compiler/2024-12-FLEX-ATTENTION-A-PROGRAMMING-MODEL-FOR-GENERATING-OPTIMIZED-ATTENTION-KERNELS.html)** - 生成优化注意力核的编程模型
- **[2024-10] [FLUX: FAST SOFTWARE-BASED COMMUNICATION OVERLAP ON GPUS THROUGH KERNEL FUSION](/llm/engineering/compiler/2024-10-FLUX-FAST-SOFTWARE-BASED-COMMUNICATION-OVERLAP-ON-GPUS-THROUGH-KERNEL-FUSION.html)** - 通过核融合在GPU上实现基于软件的快速通信重叠

### 机器学习系统
- **[2025-07] [Demystifying NCCL: An In-depth Analysis of GPU Communications Protocols and Algorithms](/mlsys/networking/2025-07-Demystifying-NCCL-An-In-depth-Analysis-of-GPU-Communications-Protocols-and-Algorithms.html)** - 深入分析GPU通信协议和算法
- **[2015-07] [UCX: An Open Source Framework for HPC Network APIs and Beyond](/mlsys/networking/2015-07-UCX-An-Open-Source-Framework-for-HPC-Network-APIs-and-Beyond.html)** - 高性能计算网络API及更多功能的开源框架

---

## 关于

**[了解更多 →](/about/)**

PaperCache 是一个为深度学习、机器学习和人工智能爱好者、研究人员和实践者提供的综合资源中心。

---

*本集合持续更新AI和机器学习领域的最新研究和见解。*
