// Smoke test for fastembed migration
// This tests that the embedding service works with the new fastembed library

import { EmbeddingService } from './src/services/embedding-service.js';

async function smokeTest() {
  console.log('🧪 Starting Embedding Service Smoke Test...\n');

  try {
    // Initialize service
    console.log('1️⃣  Initializing EmbeddingService...');
    const service = new EmbeddingService();
    console.log('   ✅ Service created\n');

    // Test single embedding
    console.log('2️⃣  Testing single embedding...');
    const text = 'Hello, this is a test document about machine learning.';
    console.log(`   Input: "${text}"`);
    
    const startSingle = Date.now();
    const embedding = await service.embed(text);
    const timeSingle = Date.now() - startSingle;
    
    console.log(`   ✅ Embedding generated in ${timeSingle}ms`);
    console.log(`   📊 Dimensions: ${embedding.length}`);
    console.log(`   📊 First 5 values: [${embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);
    console.log(`   📊 Type: ${typeof embedding[0]}`);
    
    // Verify dimensions
    if (embedding.length !== 384) {
      throw new Error(`Expected 384 dimensions, got ${embedding.length}`);
    }
    console.log('   ✅ Correct dimensions (384)\n');

    // Test batch embedding
    console.log('3️⃣  Testing batch embeddings...');
    const texts = [
      'Machine learning is a subset of artificial intelligence.',
      'Deep learning uses neural networks.',
      'Natural language processing helps computers understand text.',
      'Computer vision enables image recognition.',
      'Reinforcement learning trains agents through rewards.',
    ];
    console.log(`   Input: ${texts.length} texts`);
    
    const startBatch = Date.now();
    const embeddings = await service.embedBatch(texts);
    const timeBatch = Date.now() - startBatch;
    
    console.log(`   ✅ Batch embeddings generated in ${timeBatch}ms`);
    console.log(`   📊 Count: ${embeddings.length}`);
    console.log(`   📊 Each dimension: ${embeddings[0].length}`);
    console.log(`   📊 Avg time per embedding: ${(timeBatch / texts.length).toFixed(2)}ms`);
    
    // Verify batch results
    if (embeddings.length !== texts.length) {
      throw new Error(`Expected ${texts.length} embeddings, got ${embeddings.length}`);
    }
    console.log('   ✅ Correct batch count\n');

    // Test cosine similarity
    console.log('4️⃣  Testing cosine similarity...');
    const sim1 = service.cosineSimilarity(embeddings[0], embeddings[1]);
    const sim2 = service.cosineSimilarity(embeddings[0], embeddings[2]);
    const sim3 = service.cosineSimilarity(embeddings[0], embeddings[0]);
    
    console.log(`   📊 Similarity (ML vs DL): ${sim1.toFixed(4)}`);
    console.log(`   📊 Similarity (ML vs NLP): ${sim2.toFixed(4)}`);
    console.log(`   📊 Similarity (ML vs ML): ${sim3.toFixed(4)}`);
    
    if (sim3 < 0.99) {
      throw new Error(`Self-similarity should be ~1.0, got ${sim3}`);
    }
    console.log('   ✅ Self-similarity is correct\n');

    // Test findSimilar
    console.log('5️⃣  Testing findSimilar...');
    const query = embeddings[0]; // "Machine learning..."
    const candidates = embeddings.slice(1).map((emb, idx) => ({
      id: `doc-${idx + 1}`,
      embedding: emb,
    }));
    
    const similar = service.findSimilar(query, candidates, 3);
    console.log(`   📊 Top 3 similar documents:`);
    similar.forEach((result, idx) => {
      console.log(`      ${idx + 1}. ${result.id} (score: ${result.score.toFixed(4)})`);
    });
    
    if (similar.length !== 3) {
      throw new Error(`Expected 3 results, got ${similar.length}`);
    }
    console.log('   ✅ findSimilar works correctly\n');

    // Performance summary
    console.log('📊 Performance Summary:');
    console.log(`   Single embedding: ${timeSingle}ms`);
    console.log(`   Batch (5 texts): ${timeBatch}ms`);
    console.log(`   Per-text average: ${(timeBatch / texts.length).toFixed(2)}ms`);
    console.log('');

    // Success!
    console.log('✅ ✅ ✅ ALL TESTS PASSED! ✅ ✅ ✅\n');
    console.log('🎉 fastembed migration successful!');
    console.log('📦 Package: fastembed@2.0.0');
    console.log('🤖 Model: sentence-transformers/all-MiniLM-L6-v2');
    console.log('📏 Dimensions: 384');
    console.log('🚀 Status: Ready for production\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ SMOKE TEST FAILED!\n');
    console.error('Error:', error.message);
    console.error('\nStack trace:');
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the smoke test
smokeTest();
