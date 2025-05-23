import { NextRequest, NextResponse } from 'next/server';
import { apiClient } from '@/lib/apiClient';
import { config } from '@/lib/config';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const skip = searchParams.get('skip') || '0';
  const limit = searchParams.get('limit') || '10';

  try {
    // 使用配置化的API客户端
    const params = { skip, limit };
    const data = await apiClient.get(config.endpoints.flashes.latest, params);
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching flashes in API route:', error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { 
          error: 'Internal Server Error while fetching flashes.', 
          details: error.message 
        }, 
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal Server Error while fetching flashes.' }, 
      { status: 500 }
    );
  }
} 