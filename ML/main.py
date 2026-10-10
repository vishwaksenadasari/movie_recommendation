import numpy as np

from support import (
    cd_similarity,
    ig_similarity,
    titles,
    title_to_index
)


def cd_recommend(movie):
    movie_index = title_to_index[movie]

    distances = cd_similarity[movie_index]

    # Get indices of top 21 similarities
    top_indices = np.argpartition(distances, -21)[-21:]

    # Sort only those 21
    top_indices = top_indices[
        np.argsort(distances[top_indices])[::-1]
    ]

    return [
        [titles[i], i, distances[i], "cd"]
        for i in top_indices
        if titles[i] != movie
    ][:20]


def ig_recommend(movie):
    movie_index = title_to_index[movie]

    distances = ig_similarity[movie_index]

    # Get indices of top 21 similarities
    top_indices = np.argpartition(distances, -21)[-21:]

    # Sort only those 21
    top_indices = top_indices[
        np.argsort(distances[top_indices])[::-1]
    ]

    return [
        [titles[i], i, distances[i], "ig"]
        for i in top_indices
        if titles[i] != movie
    ][:20]


def recommend_movies(movie):
    return cd_recommend(movie) + ig_recommend(movie)


for movie in recommend_movies("Tuck Jagadish"):
    print(movie)