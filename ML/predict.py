import sys
import json
import numpy as np
from support import cd_similarity, ig_similarity, titles, title_to_index

def cd_recommend(movie):
    movie_index = title_to_index[movie]
    distances = cd_similarity[movie_index]
    top_indices = np.argpartition(distances, -21)[-21:]
    top_indices = top_indices[np.argsort(distances[top_indices])[::-1]]
    return [[titles[i], i, float(distances[i]), "cd"] for i in top_indices if titles[i] != movie][:20]

def ig_recommend(movie):
    movie_index = title_to_index[movie]
    distances = ig_similarity[movie_index]
    top_indices = np.argpartition(distances, -21)[-21:]
    top_indices = top_indices[np.argsort(distances[top_indices])[::-1]]
    return [[titles[i], i, float(distances[i]), "ig"] for i in top_indices if titles[i] != movie][:20]

if __name__ == '__main__':
    try:
        movie = sys.argv[1]
        recs = cd_recommend(movie) + ig_recommend(movie)
        print(json.dumps(list(set([r[0] for r in recs]))))
    except Exception as e:
        print(json.dumps([]))
