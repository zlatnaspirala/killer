CC = gcc
CXX = g++
CFLAGS = -Wall -Wextra -O3 -Iinclude
CXXFLAGS = -std=c++17 -Wall -Wextra -O3 -Iinclude

SRCS = src/core/Engine.cpp src/core/Renderer.cpp
OBJS = $(SRCS:.cpp=.o)
TARGET = libengine.a

all: $(TARGET)

$(TARGET): $(OBJS)
	ar rcs $@ $^

%.o: %.cpp
	$(CXX) $(CXXFLAGS) -c $< -o $@

clean:
	rm -f $(OBJS) $(TARGET)

.PHONY: all clean
