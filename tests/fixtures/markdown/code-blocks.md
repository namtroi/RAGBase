# Code Blocks Test

This markdown file contains code blocks to test chunking behavior.

## JavaScript Example

```javascript
function hello(name) {
  console.log(`Hello, ${name}!`);
  return true;
}

hello('World');
```

The code block above should be preserved during chunking.

## Python Example

```python
def calculate_sum(a, b):
    """Calculate the sum of two numbers."""
    return a + b

result = calculate_sum(5, 3)
print(f"Result: {result}")
```

## TypeScript Example

```typescript
interface User {
  id: string;
  name: string;
  email: string;
}

const user: User = {
  id: '123',
  name: 'Test User',
  email: 'test@example.com'
};
```

Code blocks should be treated as atomic units during chunking.
