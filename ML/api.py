from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
from support import cd_similarity, ig_similarity, titles, title_to_index

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def cd_recommend(movie):
    if movie not in title_to_index:
        return []
    movie_index = title_to_index[movie]
    distances = cd_similarity[movie_index]
    top_indices = np.argpartition(distances, -21)[-21:]
    top_indices = top_indices[np.argsort(distances[top_indices])[::-1]]
    return [[titles[i], i, float(distances[i]), "cd"] for i in top_indices if titles[i] != movie][:20]

def ig_recommend(movie):
    if movie not in title_to_index:
        return []
    movie_index = title_to_index[movie]
    distances = ig_similarity[movie_index]
    top_indices = np.argpartition(distances, -21)[-21:]
    top_indices = top_indices[np.argsort(distances[top_indices])[::-1]]
    return [[titles[i], i, float(distances[i]), "ig"] for i in top_indices if titles[i] != movie][:20]

@app.get("/recommend/{movie_name}")
def recommend(movie_name: str):
    try:
        recs = cd_recommend(movie_name) + ig_recommend(movie_name)
        if not recs:
            return {"recommendations": []}
        
        # Extract just the unique movie titles
        unique_titles = list(set([r[0] for r in recs]))
        return {"recommendations": unique_titles}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
