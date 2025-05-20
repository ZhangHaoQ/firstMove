from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import json
import asyncio
import uvicorn
import time # Added for timestamp calculations
from typing import List, Dict, Any
import logging # Import logging

# Import sync redis client. Async client related parts will be commented out.
# from core.redis.client import redis_client, async_redis_client, get_flash_data, ALL_FLASHES_BY_TIME_KEY, FLASH_DATA_PREFIX
from core.redis.client import redis_client, get_flash_data, ALL_FLASHES_BY_TIME_KEY, FLASH_DATA_PREFIX

# Get a logger for this module
logger = logging.getLogger(__name__)
# You might want to configure logging level and format for uvicorn or FastAPI if not already done
# For basic output to console where uvicorn runs:
logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="AI Stock Intelligence API",
    description="API for providing AI-analyzed stock market news flashes.",
    version="0.2.2" # Incremented version
)

# CORS Configuration
origins = [
    "http://localhost:3000",  # Next.js frontend default port
    "http://127.0.0.1:3000",
    # Add other origins if needed, e.g., your production frontend URL
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], # Allow all methods
    allow_headers=["*"], # Allow all headers
)

# Add startup and shutdown events for the async_redis_client connection pool
# /* Commenting out async_redis_client startup/shutdown events
# @app.on_event("startup")
# async def startup_event():
#     try:
#         await async_redis_client.ping()
#         logger.info("Async Redis client connected and pinged successfully on startup.")
#     except Exception as e:
#         logger.error(f"Error connecting to async_redis_client on startup: {e}", exc_info=True)
# 
# @app.on_event("shutdown")
# async def shutdown_event():
#     await async_redis_client.close()
#     logger.info("Async Redis client connection closed on shutdown.")
# */

@app.get("/flashes/latest/", 
            response_model=List[Dict[str, Any]],
            summary="Get AI-analyzed financial news flashes from the last 24 hours",
            description="Retrieves a paginated list of AI-analyzed financial news flashes published within the last 24 hours, sorted by publication time in descending order. Flashes without AI analysis are excluded.")
async def get_latest_flashes(
    skip: int = Query(0, ge=0, description="Number of items to skip for pagination based on AI-analyzed flashes"),
    limit: int = Query(10, ge=1, le=100, description="Number of AI-analyzed items to return per page (max 100)")
) -> List[Dict[str, Any]]:
    try:
        current_server_time_unix = time.time()
        twenty_four_hours_ago_unix = current_server_time_unix - (24 * 60 * 60)

        # Fetch a potentially larger batch of IDs to account for filtering
        # This is a simple approach; more complex pagination might be needed for very sparse analyzed data
        # Let's fetch up to (skip + limit + buffer_for_filtering), e.g., limit*2 or fixed like 50-100, then filter
        # For now, we will fetch IDs based on time window and then filter. 
        # The actual number of items returned might be less than 'limit'.
        
        # Step 1: Get all flash IDs from the last 24 hours. We won't paginate IDs here yet.
        all_flash_ids_in_24h = redis_client.zrevrangebyscore(
            ALL_FLASHES_BY_TIME_KEY,
            max='+inf',
            min=twenty_four_hours_ago_unix
        )
        # No start/num here, get all then filter and paginate in Python. More robust for filtering.

        if not all_flash_ids_in_24h:
            return []
        
        analyzed_flashes_in_24h = []
        for flash_id_str in all_flash_ids_in_24h: 
            flash_data = get_flash_data(flash_id_str) 
            if flash_data and 'llm_analysis' in flash_data: # Crucial check here
                analyzed_flashes_in_24h.append(flash_data)
            # else: flash is either not found or hasn't been analyzed yet - skip it
        
        # Step 2: Apply pagination (skip, limit) to the list of *analyzed* flashes
        paginated_flashes = analyzed_flashes_in_24h[skip : skip + limit]
        
        return paginated_flashes

    except Exception as e:
        logger.error(f"Error retrieving latest AI-analyzed flashes (last 24h): {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Could not retrieve latest AI-analyzed flashes from the database.")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

# 可以在这里添加更多的路由和逻辑